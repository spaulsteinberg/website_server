//import and require dependency packages
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');

//choose a port to run server
const PORT = 3000;

//create an instance of express
const app = express();

//specify body-parser to handle JSON data
app.use(bodyParser.json());

//have express use the cors package
app.use(cors());

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'website_contact',
    password: ''
});
const tableName = "contact_request"

//send get from root ('/'), callback functon has access to the request and the response
app.get('/', function(request, response){
    response.send("hello from server");
});

//send post from '/enroll', creating an endpoint
app.post('/enroll', function(request, response){
    console.log(request.body);
    if (response.statusCode === 200 || response.statusCode === 201){
        console.log("Successful:", response.statusCode);
       /* request.body.email = request.body.email.trim();
        request.body.firstName = request.body.firstName.trim();
        request.body.lastName = request.body.lastName.trim();*/
        connection.query(`INSERT INTO ${tableName} SET ?`, request.body, function(error, results, fields){
            if (error){
                throw error;
            }
            else {
                response.send({"database_success": results});
            }
        });
       /* response.status(200).send({"message": "Data received",
                                        "data": request.body});*/
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