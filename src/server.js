//import and require dependency packages
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const Validator = require('validatorjs');
const connectParams = require('../important');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const client = require('twilio')(connectParams.twilio.ACCOUNT_SID, connectParams.twilio.AUTH_TOKEN);
const { google } = require('googleapis');
const { request } = require('express');

//create new JWT auth instance
const jwt = new google.auth.JWT(connectParams.analytics.SERVICE_ACCOUNT.client_email, null, connectParams.analytics.SERVICE_ACCOUNT.private_key, connectParams.analytics.SCOPE);


//choose a port to run server
const PORT = 3000;

//create an instance of express
const app = express();

//specify body-parser to handle JSON data
app.use(bodyParser.json());

//have express use the cors package
app.use(cors());

//should hit the apache server on xampp. Port 80
const connection = mysql.createConnection({
    host: connectParams.fields.HOST,
    user: connectParams.fields.USER,
    database: connectParams.fields.DATABASE_NAME,
    password: connectParams.fields.PASSWORD
});
const tableName = connectParams.fields.TABLE_NAME;

//validation rules, check against request.body
const rules = {
    firstName: connectParams.valid.FIRST_NAME,
    lastName: connectParams.valid.LAST_NAME,
    email: connectParams.valid.EMAIL,
    phone: connectParams.valid.PHONE,
    description: connectParams.valid.DESCRIPTION
};

//send get from root ('/'), callback functon has access to the request and the response
app.get('/', function(request, response){
    response.send("Im the server. Online and running...");
    jwtConnect();
});

async function jwtConnect(){
    const res = await jwt.authorize();
}

//send post from '/setcontact', creating an endpoint
app.post('/setcontact', function(request, response){
    console.log(request.body);
    let validation = new Validator(request.body, rules);
    let passed = validation.passes() ? "Yes" : "No";
    console.log(`Passed? --> ${passed}`);
    if (response.statusCode === 200 || response.statusCode === 201){
        console.log("Successful:", response.statusCode);
       /* strip leading and trailing chars */
        request.body.email = request.body.email.trim();
        request.body.firstName = request.body.firstName.trim();
        request.body.lastName = request.body.lastName.trim();
        // using ? will escape the characters
        connection.query(`INSERT INTO ${tableName} SET ?`, request.body, function(error, results, fields){
            if (error){
                throw error;
            }
            else {
                response.send({"database_success": `Your feedback has been submitted, ${request.body.firstName}! Click to close.`});
                sendAlertEmail(request.body); //send email on success
                sendSMSAlert(); //sms on success
            }
        });
    }
    else {
        console.log("Failed with code:", response.statusCode);
    }
})

//set server to listen on the port
app.listen(PORT, function(){
    console.log("Listening on port...", PORT);
});

let googleOAuth = {
    type: 'OAuth2',
    user: connectParams.email.AUTH.USER,
    clientId: connectParams.email.AUTH.CLIENT_ID,
    clientSecret: connectParams.email.AUTH.SECRET_ID,
    refreshToken: connectParams.email.AUTH.REFRESH_TOKEN,
    accessToken: connectParams.email.AUTH.ACCESS_TOKEN
}

//configure transport. using gmail registered through their api
let transport = nodemailer.createTransport({
    host: connectParams.email.HOST,
    service: connectParams.email.SERVICE,
    auth: googleOAuth
});

//mailParams determines message sender/receriver and content
let mailParams = {
    from: connectParams.email.OPTIONS.FROM,
    to: connectParams.email.OPTIONS.TO,
}
//mess with the current date
function getFormattedDate(){
    let oldDate = new Date();
    return `${oldDate.toString()}`;
}

//log email output
const logFileName = '../logs/logfile.txt';
function writeLogger(res, curDate){
    res = `${curDate} --- ${res}\n`;
    fs.appendFile(path.resolve(__dirname, logFileName), res, function (err) {
        if (err) throw err;
        console.log('Saved to log.');
      });   
}
//send an email alert
async function sendAlertEmail(content){
    curDate = getFormattedDate();
    mailParams.subject = `WEBSITE FEEDBACK FROM ${curDate}`;
    mailParams.html = `<p>First Name: ${content.firstName}</p>
                       <p>Last Name: ${content.lastName}</p>
                       <p>Email: ${content.email}</p>
                       <p>Phone: ${content.phone}</p>
                       <p>Description: ${content.description}</p>`;
    transport.sendMail(mailParams, function(error, info){
        console.log(error ? error : info.response);
        writeLogger(error ? error : info.response, curDate);
    });
}

//send an SMS alert
async function sendSMSAlert(){
    client.messages.create({
     body: `New Feedback from site made at ${getFormattedDate()}. Check Email for details.`,
     from: connectParams.twilio.FROM_NUMBER,
     to: connectParams.twilio.TO_NUMBER
   })
  .then(message => console.log(message.sid));
}

//request for last 30 days of pageviews
app.get('/websitePageViews30days', async (request, response) => {
    try {
        const result = await google.analytics('v3').data.ga.get({
        'auth': jwt,
        'ids': 'ga:' + connectParams.analytics.VIEW_ID,
        'start-date': '30daysAgo',
        'end-date': 'today',
        'metrics': 'ga:pageviews, ga:timeOnPage, ga:avgTimeOnPage'
        });
        response.send({
            "status": 200,
            "data": result,
            "pageviews": result.data.rows[0][0],
            "timeOnPage": result.data.rows[0][1],
            "avgTimeOnPage": result.data.rows[0][2]
        });
    } catch (error){
        console.log(error);
        response.send({
            "status": error, 
            "errorMessage": "Error occurred getting pageview data."
        });
    }
})

// last 30 days of event data
app.get('/websiteEventData30days', async (request, response) => {
    try {
        const result = await google.analytics('v3').data.ga.get({
        'auth': jwt,
        'ids': 'ga:' + connectParams.analytics.VIEW_ID,
        'start-date': '30daysAgo',
        'end-date': 'today',
        'dimensions': 'ga:eventAction',
        'metrics': 'ga:totalEvents, ga:uniqueEvents'
        });
        response.send({
            "status": 200,
            "payload": result.data.rows
        });
    } catch (error){
        console.log(error);
        response.send({
            "status": error, 
            "errorMessage": "Error occurred getting event data."
        });
    }
})

// feedback count from db
app.get('/feedback/count', function(request, response){
    connection.query(`SELECT COUNT(*) FROM ${tableName}`, function(error, results, fields){
        if (error){
            response.send({"status": "Bad Query"});
            throw error;
        }
        else {
            console.log(results, fields);
            response.send({
                "status": "OK",
                "count": results[0]['COUNT(*)']
            });
        }
    });
})

//path paths, times, etc
app.get('/pagevisits', async (request, response) => {
    try {
        const result = await google.analytics('v3').data.ga.get({
            'auth': jwt,
            'ids': 'ga:' + connectParams.analytics.VIEW_ID,
            'start-date': '30daysAgo',
            'end-date': 'today',
            'dimensions': 'ga:pagePath, ga:pageTitle',
            'metrics': 'ga:pageviews, ga:avgTimeOnPage'
            });
        response.send({
            "status": "OK",
            "data": result.data.rows
        });
    }catch(e){
        console.log(e);
        response.send({"status": response});
    }
})

//get locations and page speeds
app.get('/speed', async (request, response) => {
    try {
        const result = await google.analytics('v3').data.ga.get({
            'auth': jwt,
            'ids': 'ga:' + connectParams.analytics.VIEW_ID,
            'start-date': '30daysAgo',
            'end-date': 'today',
            'dimensions': 'ga:continent, ga:country, ga:city, ga:region',
            'metrics': 'ga:pageLoadTime, ga:redirectionTime, ga:avgServerResponseTime'
            });
        response.send({
            "status": "OK",
            "data": result.data.rows
        });
    }catch(e){
        console.log(e);
        response.send({"status": response});
    }
})

//get pageviews by date
app.get('/pageViewsOnTime', async (request, response) => {
    try {
        const result = await google.analytics('v3').data.ga.get({
            'auth': jwt,
            'ids': 'ga:' + connectParams.analytics.VIEW_ID,
            'start-date': '30daysAgo',
            'end-date': 'today',
            'dimensions': 'ga:date',
            'metrics': 'ga:pageviews, ga:uniquePageviews, ga:totalEvents, ga:uniqueEvents, ga:hits, ga:sessionDuration, ga:avgSessionDuration, ga:eventsPerSessionWithEvent'
            });
        response.send({
            "status": "OK",
            "data": result.data.rows
        });
    }catch(e){
        console.log(e);
        response.send({"status": response});
    }
})