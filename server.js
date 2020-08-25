//import and require dependency packages
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const Validator = require('validatorjs');
const connectParams = require('./important');

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
    firstName: 'required|min:3|max:20',
    lastName: 'required|min:2|max:30',
    email: 'required|email|max:320',
    phone: 'required',
    description: 'max:100'
}

//send get from root ('/'), callback functon has access to the request and the response
app.get('/', function(request, response){
    response.send("Im online");
});

//send post from '/enroll', creating an endpoint
app.post('/enroll', function(request, response){
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
                response.send({"database_success": "Your feedback has been received!"});
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

/* RUN ON NODE WITH: $ node server */