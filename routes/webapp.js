// webapp module

var express = require('express');
var router = express.Router();
var db = require('../connection');

// GET index page
router.get('/', function(req, res, next) {
	var user = userInfo(req); 

	res.render('index', {user: user});
});


// GET search page
router.get('/search', function(req, res) {
	var user = userInfo(req); 

	var location = req.body.location;
	var from_date = req.body.from_date;
	var to_date = req.body.to_date;

	res.render('search', {user: user, location: location, from_date: from_date, to_date:to_date});

});


// POST search houses
router.post('/search', function(req, res) {
	var user = userInfo(req); 

	var location = req.body.location;
	var from_date = req.body.from_date;
	var to_date = req.body.to_date;

	res.render('search', {user: user, location: location, from_date: from_date, to_date:to_date});
});


// GET current user's profile
router.get('/dashboard', isLoggedIn, function(req, res) {
	var user = userInfo(req); 

	res.render('dashboard', {user: user, noRegisterBtn: 1});
});



// GET house register page
router.get('/register', function(req, res) {
	if(!req.isAuthenticated()) {
		res.redirect('/login');
	}
	var context = {};

	var user = userInfo(req);

	context['user'] = user;
	context['noRegisterBtn'] = 1;

	getAllObjects("amenities", context, function(err, rows) {
		if(err) {
			res.json(err);
		}

		else {
			context['amenities'] = JSON.parse(JSON.stringify(rows));
			res.render('register', context);
		}
	});
});


router.post('/register', function(req, res) {
	console.log(req.body);
});



module.exports = router;


// ===== Helper functions =====

// if user is not logged in, navigates to index page 
function isLoggedIn(req, res, next) {
	// if user is authenticated in the session, carry on
	if (req.isAuthenticated())
		return next();

	// if they aren't redirect them to the home page
	res.redirect('/');
};

// returns user's info object if user is logged in
function userInfo(req) {
	if(req.isAuthenticated()) {
		var userInfo = {
			username : req.user.lastname + req.user.firstname,
			firstname: req.user.firstname,
			lastname: req.user.lastname, 
			email: req.user.email,
			mobile_num: req.user.mobile_num,
			dob: req.user.date_of_birth, 
			about: req.user.about,
			status: req.user.status
		};
		return userInfo; 
	}
};



// get all objects of given name
function getAllObjects(name, context, callback) {
	return db.query("select * from ??", [name], callback);
}


