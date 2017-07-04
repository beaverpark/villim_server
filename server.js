var express = require('express');
var app = express();
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport')
var session = require('express-session')
var flash = require('connect-flash');
var MySQLStore = require('express-mysql-session')(session);

// Load db connection from connection file 
var connection = require('./connection');



/**************/
/*** Routes ***/
/**************/
var webapp = require('./routes/webapp');
var android = require('./routes/android');
// var ios = require('./routes/ios');



/*************************/
/*** app general setup ***/
/*************************/
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));



/**************************************/
/*** npm downloaded css, js scripts ***/
/**************************************/
app.use('/js', express.static(__dirname + '/node_modules/materialize-css/dist/js'));
app.use('/css', express.static(__dirname + '/node_modules/materialize-css/dist/css'));
app.use('/jquery', express.static(__dirname + '/node_modules/jquery/dist'));
app.use('/jquery_validate', express.static(__dirname + '/node_modules/jquery-form-validator/form-validator/'));

/**************************************/
/*** other npm downloaded libraries ***/
/**************************************/


/***************************************/
/*** TWILIO (phone verification) API ***/
/***************************************/
require('./phone_verification')(app);


/********************************************/
/*** PASSPORT(login, signup, session) API ***/
/********************************************/
require('./config/passport')(passport, connection);

var sessionStore = new MySQLStore({}, connection); // storage for session info

// passport session config
app.use(session({
	secret: 'ganghobeaver',
	store: sessionStore, 
	resave: false, 
	saveUninitialized: false})
); 
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// pass in app and fully configured passport & load authentication module
require('./authentication.js')(app, passport); // load our routes and pass in our app and fully configured passport


/**************************/
/*** app url navigation ***/
/**************************/
app.use('/', webapp);
app.use('/a/', android);



/**********************/
/*** error handling ***/
/**********************/
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;