// webapp module

var express = require('express');
var router = express.Router();
var db = require('../connection');
var moment = require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");



// moment.tz.setDefault("Asia/Seoul");
// console.log(moment().format("YYYY-MM-DD HH:MM:SS"));

// GET index page
router.get('/', function(req, res, next) {
	if(req.user && req.user.is_admin[0]) {
		res.redirect('/admin');
	}	
	else {
		var user = userInfo(req);
		res.render('index', {user: user});
	}
});


// TODO: redirect this back to search
// GET search page
router.get('/search', function(req, res) {
	res.redirect('/');
});


// POST search houses
router.post('/search', function(req, res) {
	var	context = {};

	var user = userInfo(req); 
	context['user'] = user; 
	context['location'] = req.body.location;
	context['from_date'] = req.body.from_date;
	context['to_date'] = req.body.to_date;

	var query_context = {};

	// for now, query all rooms 
	selectHouse_search(query_context, function(err, rows) {
		if(err) console.log(err);

		else {

			console.log("select houses successful");
			context['house_main_image'] = JSON.parse(JSON.stringify(rows[0]));

			// TODO: process monthly rate with commas ex-  150,000,000
			context['house_monthly_rate'] = JSON.parse(JSON.stringify(rows[1]));
			context['house_addr_summary'] = JSON.parse(JSON.stringify(rows[2]));
			context['house_avg_rating'] = JSON.parse(JSON.stringify(rows[3]));
			context['house_name'] = JSON.parse(JSON.stringify(rows[4]));

			console.log(context)
			res.render('search', context);
		}
	});

});


function selectHouse_search(context, callback) {
	return db.query("select main_image from house; select monthly_rate from house; select addr_summary from house; select avg_rating from house; select name from house", callback);
}



// GET current user's profile
router.get('/dashboard', isLoggedIn, function(req, res) {
	var user = userInfo(req); 

	res.render('dashboard', {user: user, noRegisterBtn: 1});
});



// GET house register page
router.get('/register', function(req, res) {
	if (!req.isAuthenticated()) {
		res.redirect('login');
	}

	var context = {};

	var user = userInfo(req);

	context['user'] = user;
	context['noRegisterBtn'] = 1;

	selectAllObjects1("amenities", context, function(err, rows) {
		if(err) {
			res.json(err);
		}

		else {
			context['amenities'] = JSON.parse(JSON.stringify(rows));
			res.render('register', context);
		}
	});
});

// POST register house
router.post('/register', isLoggedIn, function(req, res) {

	var house_context = {};

	house_context['user_id'] = req.user.id; 
	house_context['name'] = req.body.house_name;
	house_context['addr_full'] = req.body.address;
	// house_context['addr_summary'] = req.body.
	// house_context['addr_direction'] = req.body.
	// house_context['description'] = req.body.
	house_context['room_type'] = req.body.house_type;
	// house_context['num_guest'] = req.body.
	house_context['num_bedroom'] = req.body.num_bedroom;
	house_context['num_bed'] = req.body.num_bed;
	house_context['num_bathroom'] = req.body.num_bathroom;
	// house_context['daily_rate'] = req.body.
	house_context['monthly_rate'] = req.body.monthly_rate;
	// house_context['deposit'] = req.body.
	// house_context['cleaning_fee'] = req.body.;
	house_context['utility_fee'] = req.body.utility_fee;
	// house_images 

	// TODO: update this list if additional amenities gets added to the db
	var amenitiesList = [req.body.amenities1, req.body.amenities2, req.body.amenities3, req.body.amenities4, req.body.amenities5, req.body.amenities6,
						req.body.amenities7, req.body.amenities8, req.body.amenities9, req.body.amenities10, req.body.amenities11, req.body.amenities12,
						req.body.amenities13, req.body.amenities14, req.body.amenities15, req.body.amenities16, req.body.amenities17, req.body.amenities18];

	// save the selected amenities into list  
	var amenities = [];
	for(var i=0; i<amenitiesList.length; i++) {
		if(amenitiesList[i] == "on") {
			amenities.push(i + 1);
		}
	}
	house_context['amenities'] = amenities; 

	// insert into house table 
	insertHouse(house_context, function(err, rows) {
		if(err) 
			console.log(err);

		else {
			console.log("register house successful");

			var houseAmenities_context = {};

			houseAmenities_context['house_id'] = rows.insertId;
			houseAmenities_context['amenities'] = house_context.amenities;

			// link house and its amenities 
			insertHouseAmenities(houseAmenities_context, function(err, rows) {
				if(err) res.json(err);

				else {
					console.log("register house amenities successful");
					res.redirect('/');
				}
			});
		}
	});
});


// GET admin page
router.get('/admin', isLoggedIn, function(req, res) {
	var user = userInfo(req); 

	var context = {};

	var date;
	date = new Date();
	date = date.getUTCFullYear() + '-' +
    ('00' + (date.getUTCMonth()+1)).slice(-2) + '-' +
    ('00' + date.getUTCDate()).slice(-2) + ' ' + 
    ('00' + date.getUTCHours()).slice(-2) + ':' + 
    ('00' + date.getUTCMinutes()).slice(-2) + ':' + 
    ('00' + date.getUTCSeconds()).slice(-2);
	console.log(date);

	context['user'] = user; 

	// get all cols from user, house ,reservation, amenities table
	selectAllObjects4("user", "house", "reservation", "amenities", context, function(err, rows) {
		if(err) res.json(err);

		else {
			context['all_users'] = JSON.parse(JSON.stringify(rows[0]));
			context['all_houses'] = JSON.parse(JSON.stringify(rows[1]));
			context['all_reservations'] = JSON.parse(JSON.stringify(rows[2]));
			context['all_amenities'] = JSON.parse(JSON.stringify(rows[3]));

			res.render('admin', context);
		}
	});
});

module.exports = router;


/************************/
/*** helper functions ***/
/************************/

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
			status: req.user.status,
			is_admin: req.user.is_admin[0]
		};
		return userInfo; 
	}
};

/************************/
/*** QUERY functions ****/
/************************/

// get all cols of given table name
function selectAllObjects1(obj1, context, callback) {
	return db.query("select * from ??", [obj1], callback);
}


// get all cols of given 4 table names
function selectAllObjects4(obj1, obj2, obj3, obj4, context, callback) {
	return db.query("select * from ??; select * from ??; select * from ??; select * from ??", [obj1, obj2, obj3, obj4], callback);
}




// insert new house into house table 
function insertHouse(house_context, callback) {
	var created_at = moment().format("YYYY-MM-DD HH:MM:SS");

	// main_image 

	var insertQuery = "insert into house (user_id, name, addr_full, room_type, num_bedroom, num_bed, num_bathroom, monthly_rate, utility_fee, created) values (?,?,?,?,?,?,?,?,?,?)";
	return db.query(insertQuery, [house_context.user_id, house_context.name, house_context.addr_full, house_context.room_type, house_context.num_bedroom, house_context.num_bed, house_context.num_bathroom, house_context.monthly_rate, house_context.utility_fee, created_at], callback); 
}

// insert(link) house and its amenities into house_amenities table  
// 		houseAmenities_context = {house_id, amenities}
// 		amenities = list of amenities ids [1,3,4,5]
function insertHouseAmenities(houseAmenities_context, callback) {
	var insertQueryTxt = "insert into house_amenities (house_id, amenities_id, created) values (?,?,?)";
	var insertQuery= "";
	var values = [];

	var created_at = moment().format("YYYY-MM-DD HH:MM:SS");

	for(var i=0; i<houseAmenities_context.amenities.length; i++) {
		insertQuery += insertQueryTxt + ";";
		values.push(houseAmenities_context.house_id);
		values.push(houseAmenities_context.amenities[i]);
		values.push(created_at);
	}

	return db.query(insertQuery, values, callback);
}

