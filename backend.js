var express = require('express');
var app = express();
var bodyParser = require('body-parser');
const parseUrl = express.urlencoded({ extended: false });
const parseJson = express.json({ extended: false });
const checksum_lib = require("checksum");
const config = require("configuration");
const qs = require("querystring");
const https = require("https");
var urlencodedParser = bodyParser.urlencoded({ extended: true });
var MongoClient = require('mongodb').MongoClient;
app.use(express.static(__dirname));
app.get('/register', function (req, res) {
    res.sendFile(__dirname + "/" + "index3.html");
})

app.post('/signup', urlencodedParser, function (req, res) {
    response = {
        user_name: req.body.username,
        password: req.body.password,
        email: req.body.email
    };
    response2 = { user_name: req.body.username };
    //Store sign up details in mongodb --db(Project1)
    var MongoClient = require('mongodb').MongoClient,
        format = require('util').format;
    MongoClient.connect('mongodb://127.0.0.1:27017/', function (err, db) {
        if (err) throw err;
        else {
            console.log("Connected to Database");
        }
        //insert record
        var dbo = db.db("MyProject");   
        dbo.collection('newcustomer').findOne(response2, function (err, result) 
        {   
            if (err) throw err;
            if (result) {
                console.log("Username successfully inserted");
                res.sendFile(__dirname + "/" + "index3.html");
            } 
            if (!result) {
                dbo.collection('newcustomer').insertOne(response, function (err, result) {                    
                    if (err) throw err; //this is throwing error 
                    else {
                        console.log("Record added & Account created");
                        console.log(JSON.stringify(response));
                        res.end("Account created");
                        res.sendFile(__dirname + "/" + "index3.html");
                    }
                });
            }
            db.close();
        });
    });
    console.log(response);
    //res.send(JSON.stringify(response));
    //res.redirect("/y.html")
})
//Sign in form details
app.post('/login', urlencodedParser, function (req, res) {
    response = {
        user_name: req.body.username
    };

    response2 = { user_name: req.body.username, password: req.body.password };
    //Check the user is valid or not
    var MongoClient = require('mongodb').MongoClient, 
    format = require('util').format;
    MongoClient.connect('mongodb://127.0.0.1:27017/', function (err, db) {
        if (err) throw err;
        console.log("connected to database");
        //var collection=db.collection('login');
        var dbo = db.db("MyProject");
        dbo.collection('newcustomer').findOne(response, function (err, result) {
            if (err) throw err;
            if (!result) {
                console.log("No user found. New register");
                res.end("No user found enter correct details");
                res.sendFile(__dirname + "/" + "index3.html");
            }
            if (result) {
                dbo.collection('newcustomer').findOne(response2, function (err, result2) {
                    if (err) throw err;
                    if (!result2) {
                        console.log(req.body.username + " is exists.But password is incorrect..");
                        res.end("Incorrect Password enter correct password");
                        res.sendFile(__dirname + "/" + "index3.html");
                    }
                    if (result2) {
                        console.log("user available.." + req.body.username + " is now logged in..");
                        res.sendFile(__dirname  + "/" + "final.html");
                    }
                });
            }
        });
    });
    console.log(response);
})
app.post("/paynow", [parseUrl, parseJson], (req, res) => {
    // Route for making payment

    var paymentDetails = {
        amount: req.body.amount,
        customerId: req.body.name,
        customerEmail: req.body.email,
        customerPhone: req.body.phone
    }
    if (!paymentDetails.amount || !paymentDetails.customerId ||
        !paymentDetails.customerEmail || !paymentDetails.customerPhone) {
        res.status(400).send('Payment failed')
    } else {
        var params = {};
        params['MID'] = config.PaytmConfig.mid;
        params['WEBSITE'] = config.PaytmConfig.website;
        params['CHANNEL_ID'] = 'WEB';
        params['INDUSTRY_TYPE_ID'] = 'Retail';
        params['ORDER_ID'] = 'TEST_' + new Date().getTime();
        params['CUST_ID'] = 'CUST0011';
        params['TXN_AMOUNT'] = paymentDetails.amount;
        params['CALLBACK_URL'] = 'http://localhost:1800/callback';
        params['EMAIL'] = paymentDetails.customerEmail;
        params['MOBILE_NO'] = paymentDetails.customerPhone;


        checksum_lib.genchecksum(params, config.PaytmConfig.key, function
            (err, checksum) {
            var txn_url = "https://securegw-stage.paytm.in/theia/processTransaction"; 

            var form_fields = "";
            for (var x in params) {
                form_fields += "<input type='hidden' name='" + x + "' value='" +
                    params[x] + "' >";
            }
            form_fields += "<input type='hidden' name='CHECKSUMHASH' value = '" + checksum + "' > ";

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write('<html><head><title>Merchant Checkout Page</title ></head > <body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' + txn_url + '"name="f1">' + form_fields + '</form><script type="text/javascript">document.f1.submit();</script></body></html > ');
            res.end();
        });
    }
});
app.post("/callback", (req, res) => {
    // Route for verifiying payment

    var body = '';

    req.on('data', function (data) {
        body += data;
    });

    req.on('end', function () {
        var html = "";
        var post_data = qs.parse(body);

        // received params in callback
        console.log('Callback Response: ', post_data, "\n");


        // verify the checksum
        var checksumhash = post_data.CHECKSUMHASH;
        // delete post_data.CHECKSUMHASH;
        var result = checksum_lib.verifychecksum(post_data,
            config.PaytmConfig.key, checksumhash);
        console.log("Checksum Result => ", result, "\n");


        // Send Server-to-Server request to verify Order Status
        var params = {
            "MID": config.PaytmConfig.mid, "ORDERID":
                post_data.ORDERID
        };

        checksum_lib.genchecksum(params, config.PaytmConfig.key, function
            (err, checksum) {

            params.CHECKSUMHASH = checksum;
            post_data = 'JsonData=' + JSON.stringify(params);

            var options = {
                hostname: 'securegw-stage.paytm.in', // for staging
                // hostname: 'securegw.paytm.in', // for production
                port: 443,
                path: '/merchant-status/getTxnStatus',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': post_data.length
                }
            };


            // Set up the request
            var response = "";
            var post_req = https.request(options, function (post_res) {
                post_res.on('data', function (chunk) {
                    response += chunk;
                });

                post_res.on('end', function () {
                    console.log('S2S Response: ', response, "\n");

                    var _result = JSON.parse(response);
                    if (_result.STATUS == 'TXN_SUCCESS') {
                        res.send('payment sucess')
                    } else {
                        res.send('payment failed')
                    }
                });
            });

            // post the data
            post_req.write(post_data);
            post_req.end();
        });
    });
});

var server = app.listen(1800, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("Example app listening at http://%s:%s//register", host, port)
})
