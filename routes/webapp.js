// webapp module
// require('babel-register')({
// 	presets: ['react', 'es2015']
// });

var express = require('express');
var router = express.Router();
var db = require('../connection');

var moment = require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");

var googleMaps = require("@google/maps").createClient({
	key: "AIzaSyDIKYpr3qNxWm2lC6VlVhoIFt3r1xy8dns"
});




var mqtt = require('mqtt');
// var client = mqtt.connect('mqtt://127.0.0.1:1883')


// client.on('connect', function () {
// 	console.log("connecting")
// 	client.subscribe('abc')
//   // client.publish('abc', 'this is client 1')
// })
	 
	// client.on('message', function(topic, message) {
	// 	console.log(message.toString())
	// 	client.end();
	// })


// import React from 'react';
// var ReactDOM = require('react-dom');
// var React = require('react');

// var ReactDOMServer = require('react-dom/server');
// var App = require('../shared/App');
// const path = require('path');

// var Component = require('../Components/layout.js');


// var Router = require('react-router');


// GET index page
router.get('/', function(req, res, next) {
	if(req.isAuthenticated()) {
		var user = req.user;
		user['username'] = req.user.lastname + req.user.firstname;
	}
	// client.publish('abc', 'client opened broser')

	res.render('index', {user: user});
});

// GET index page
router.get('/index', function(req, res, next) {
	if(req.isAuthenticated()) {
		var user = req.user;
		user['username'] = req.user.lastname + req.user.firstname;
	}
	// client.publish('abc', 'client opened broser')

	res.render('index2', {user: user});
});

router.get('/download_kor', function(req, res, next) {

	res.render('download_kor');

});

router.get('/download_en', function(req, res, next) {

	res.render('download_en');

});

router.get('/be-host_kor', function(req, res, next) {

	res.render('be-host_kor');

});

router.get('/be-host_en', function(req, res, next) {

	res.render('be-host_en');

});

// router.get('/s', function(req, res) {
// 	res.render('search2')
// });

// TODO: redirect this back to search
// GET search page
// router.post('/search', function(req, res) {

// 	console.log(req.body.checkin_date);

// 	// res.redirect('/');
// });

//

router.post('/checkout', function(req, res) {
	if(!req.isAuthenticated()) {
		req.session.returnTo = req.path;
		req.session.checkin = req.body.checkin;
		req.session.checkout = req.body.checkout;
		req.session.house_id = req.body.house_id; 
		res.redirect('/login');
	}

	// console.log(req.body)
	// console.log(req.session)

	var context = {};

	var checkin_date = (req.body.checkin) ? req.body.checkin : req.session.checkin;
	var checkout_date = (req.body.checkout) ? req.body.checkout : req.session.checkout;
	var house_id = (req.body.house_id) ? req.body.house_id : req.session.house_id;

	var checkin = moment(checkin_date);
	var checkout = moment(checkout_date);

	var date_diff = checkout.diff(checkin, 'days');

	context['checkin'] = checkin_date;
	context['checkout'] = checkout_date;
	context['duration'] = date_diff;

	getHouseInfoForCheckout(house_id, function(err, rows) {
		if(err) console.log(err);

		else {
			context['house_info'] = JSON.parse(JSON.stringify(rows))[0];
			context['daily_rate'] = intToStringWithCommas(context.house_info.daily_rate);
			context['total_rate'] = intToStringWithCommas(context.house_info.daily_rate * date_diff);

			res.render('checkout', context);
		}
	});
});

function getHouseInfoForCheckout(house_id, callback) {
	var selectQuery = "select name, addr_summary, num_guest, num_bed, num_bathroom, daily_rate, main_image from house where id = ?";
	return db.query(selectQuery, [house_id], callback);
}

function intToStringWithCommas(num) {
	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

router.get('/homes/:name/:id', function(req, res) {

	if("해방촌 2인실 - 1" == req.params.name) {
		console.log("same")
	}
	var context = {};
	console.log(req.params.name)
	console.log(req.params.id)
	context['house_id'] = req.params.id;

	selectHouseById(req.params.id, function(err, rows) {
		if(err) console.log(err);

		else {
			context['house_info'] = JSON.parse(JSON.stringify(rows))[0][0];
			context['amenities_list'] = JSON.parse(JSON.stringify(rows))[1];
			context['house_pics_list'] = JSON.parse(JSON.stringify(rows))[2];

			console.log(context)


			res.render('house_detail', context);
		}
	});
});

function selectHouseById(house_id, callback) {
	var houseQuery = "select distinct house.id as house_id, name as house_name, addr_full, addr_summary, addr_direction, description, type as house_type, num_guest, num_bedroom, num_bed, num_bathroom, monthly_rate, daily_rate, format(utility_fee,0) as utility_fee, format(cleaning_fee,0) as cleaning_fee, latitude, longitude, house_policy, cancellation_policy, main_image, rating_overall as house_rating, review_count as house_review_count from house inner join house_rating on house.id = house_rating.house_id inner join house_images on house.id = house_images.house_id where house.id = ?;";
	var amenitiesQuery = "select name, icon_image from amenities inner join house_amenities on amenities.id = house_amenities.amenities_id where house_id = ?;";
	var imageQuery = "select image from house_images where house_id = ?";

	return db.query(houseQuery + amenitiesQuery + imageQuery, [house_id, house_id, house_id], callback);
};


// GET search houses
router.get('/s', function(req, res) {
	var	context = {};

	// var location = req.params.location;
	// console.log(location)
	
	if(req.isAuthenticated()) {
		var user = req.user;
		user['username'] = req.user.lastname + req.user.firstname;
	}


	context['user'] = user; 

	var location = req.query.location; 
	var checkin = req.query.checkin;
	var checkout = req.query.checkout;

	context['location'] = location;
	context['checkin'] = checkin;
	context['checkout'] = checkout;
	// context['preferred_currency'] = req.params.curr;

	console.log(context);

	// query rooms
	selectHouse_search(location, checkin, checkout, function(err, rows) {
		if(err) console.log(err);

		else {
			console.log("select houses successful");
			context["house_list"] = JSON.parse(JSON.stringify(rows));

			// console.log()
			// console.log(JSON.parse(JSON.stringify(rows)))

			// context['house_main_image'] = JSON.parse(JSON.stringify(rows[0]));

			// // TODO: process monthly rate with commas ex-  150,000,000
			// context['house_monthly_rate'] = JSON.parse(JSON.stringify(rows[1]));
			// context['house_addr_summary'] = JSON.parse(JSON.stringify(rows[2]));
			// context['house_avg_rating'] = JSON.parse(JSON.stringify(rows[3]));
			// context['house_name'] = JSON.parse(JSON.stringify(rows[4]));

			// console.log(context)
			res.render('search', context);
		}
	});
	

});


function selectHouse_search(location, checkin, checkout, callback) {

	console.log(location + " , " + checkin + " , " + checkout);

	var location_1 = (!(location == '' || typeof location === 'undefined')) ? 1 : 0; 
	var checkin_2 = (!(checkin == '' || typeof checkin === 'undefined')) ? 2 : 0;
	var checkout_4 = (!(checkout == '' || typeof checkout === 'undefined')) ? 4 : 0;

	console.log(location_1 + " , " + checkin_2 + " , " + checkout_4);

	switch(location_1 | checkin_2 | checkout_4) {
		case 0:
			console.log("0")
			// no params
			return db.query("select h.id, h.name, h.main_image, h.daily_rate, h.num_guest, h.num_bedroom, h.num_bed, h.num_bathroom, h.addr_summary, r.rating_overall from house h inner join house_rating r on h.id = r.house_id", callback);
		case 1: 
			console.log("1")
			// only location
			var selectQuery = "select h.id, h.name, h.main_image, h.daily_rate, h.num_guest, h.num_bedroom, h.num_bed, h.num_bathroom, h.addr_summary, r.rating_overall from house h inner join house_rating r on h.id = r.house_id where h.name like ? or h.addr_summary like ?";
			return db.query(selectQuery, ['%' + location + '%', '%' + location + '%'], callback);
		case 6:
			console.log("6")
			// only checkin, checkout
			var selectQuery = "select distinct h.id, h.name, h.main_image, h.daily_rate, h.num_guest, h.num_bedroom, h.num_bed, h.num_bathroom, h.addr_summary, hr.rating_overall from house h inner join house_rating hr on h.id = hr.house_id INNER JOIN reservation re on h.id = re.house_id where h.id not in (select re.house_id from reservation re where (re.checkin >= ? and re.checkout <= ?) or (re.checkin < ? and re.checkout >= ?) or (re.checkin <= ? and re.checkout > ?)) order by h.id asc";
			return db.query(selectQuery, [checkin, checkout, checkout, checkout, checkin, checkin], callback);
		case 7:
			console.log("7")
			// all (location, checkin, checkout)
			var selectQuery = "select distinct h.id, h.name, h.main_image, h.daily_rate, h.num_guest, h.num_bedroom, h.num_bed, h.num_bathroom, h.addr_summary, hr.rating_overall from house h inner join house_rating hr on h.id = hr.house_id INNER JOIN reservation re on h.id = re.house_id where h.id not in (select re.house_id from reservation re where (re.checkin >= ? and re.checkout <= ?) or (re.checkin < ? and re.checkout >= ?) or (re.checkin <= ? and re.checkout > ?)) and (h.name like ? or h.addr_summary like ?) order by h.id asc";
			return db.query(selectQuery, [checkin, checkout, checkout, checkout, checkin, checkin,'%' + location + '%', '%' + location + '%'], callback);
		default: 
			console.log("switch default. this is probably error")
			break;			
	}

// EXAMPLE
// select distinct h.id, h.name, h.main_image, h.daily_rate, h.num_guest, h.num_bedroom, h.num_bed, h.num_bathroom, h.addr_summary, hr.rating_overall from house h inner join house_rating hr on h.id = hr.house_id INNER JOIN reservation re on h.id = re.house_id where h.id not in (select re.house_id from reservation re where (re.checkin >= '2017-06-15' and re.checkout <= '2017-06-30') or (re.checkin < '2017-06-30' and re.checkout >= '2017-06-30') or (re.checkin <= '2017-06-15' and re.checkout > '2017-06-15')) order by h.id asc

	// if(typeof location === 'undefined' && typeof checkin === 'undefined' && typeof checkout === 'undefined') {
	// 	return db.query("select h.id, h.name, h.main_image, h.daily_rate, h.num_guest, h.num_bedroom, h.num_bed, h.num_bathroom, h.addr_summary, r.rating_overall from house h inner join house_rating r on h.id = r.house_id", callback);
	// }

	// else if(typeof location !== 'undefined') {
	// 	return db.query("select h.id, h.name, h.main_image, h.daily_rate, h.num_guest, h.num_bedroom, h.num_bed, h.num_bathroom, h.addr_summary, r.rating_overall from house h inner join house_rating r on h.id = r.house_id where h.name like ? or h.addr_summary like ?", ['%' + location + '%', '%' + location + '%'], callback);
	// }

	// else if() {


	// }

	// select * from house where name like '%해방촌%'

	// return db.query("select h.id, h.name, h.main_image, h.daily_rate, h.num_guest, h.num_bedroom, h.num_bed, h.num_bathroom, h.addr_summary, r.rating_overall from house h inner join house_rating r on h.id = r.house_id", callback);
	// return db.query("select main_image from house; select monthly_rate from house; select addr_summary from house; select rating_overall from house_rating; select name from house", callback);
}



// GET current user's profile
router.get('/dashboard', isLoggedIn, function(req, res) {
	var user = req.user;
	user['username'] = req.user.lastname + req.user.firstname;

	res.render('dashboard', {user: user});
});



// GET house register page
router.get('/register', function(req, res) {
	if (!req.isAuthenticated()) {
		res.redirect('login');
	}

	var context = {};

	var user = req.user;
	user['username'] = req.user.lastname + req.user.firstname;

	context['user'] = user;
	// context['noRegisterBtn'] = 1;

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
	house_context['addr_full'] = req.body.addr_full;
	house_context['addr_summary'] = req.body.addr_summary;
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

// router.use(express.static(path.join(__dirname, '../react-app/build')));


// router.get('/*', function(req, res) {
// 	res.sendFile(path.join(__dirname, '../react-app/build/index.html'));
// });



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

	var insertQuery = "insert into house (user_id, name, addr_full, addr_summary, room_type, num_bedroom, num_bed, num_bathroom, monthly_rate, utility_fee, created) values (?,?,?,?,?,?,?,?,?,?,?)";
	return db.query(insertQuery, [house_context.user_id, house_context.name, house_context.addr_full, house_context.addr_summary, house_context.room_type, house_context.num_bedroom, house_context.num_bed, house_context.num_bathroom, house_context.monthly_rate, house_context.utility_fee, created_at], callback); 
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

