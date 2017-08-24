var express = require('express');
var router = express.Router();
var db = require('../connection');
var moment = require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");


// GET admin page
router.get('/', isAdmin, function(req, res) {
	var context = {};

	context['user'] = req.user;

	console.log(context)
	// get all cols from user, house ,reservation, amenities table
	selectObjects(context, function(err, rows) {
		if(err) res.json(err);

		else {
			var all_users = JSON.parse(JSON.stringify(rows[0]));
			// remove users' password from displaying 
			for(var i = 0; i < all_users.length; i++) {
				delete all_users[i].password;
			}

			context['all_users'] = all_users;
			context['all_houses'] = JSON.parse(JSON.stringify(rows[1]));
			context['all_reservations'] = JSON.parse(JSON.stringify(rows[2]));
			context['all_visits'] = JSON.parse(JSON.stringify(rows[3]));

			res.render('admin-dashboard', context);
		}
	});
});

// AJAX POST update table given table, col, and id
router.post('/updateTable', isAdmin, function(req, res) {
	console.log("update table")

	// data form: {"new_val":" ab@gmail.comw","id":"user_1_email"}
	var data = JSON.parse(JSON.stringify(req.body));
	var result = data.id.split("/");

	var new_val;

	if(data.new_val == "true") {
		new_val = 1;
	}

	else if(data.new_val == "false") {
		new_val = 0;
	}

	else {
		new_val = data.new_val;
	}

	var table = result[0];
	var id = Number(result[1]);
	var col = result[2];

	updateCol(table, id, col, new_val, function(err, rows) {
		if(err) {
			console.log("update err: " + err) 
			res.status(400).json(err);
		}

		else {
			console.log("update success");
			res.status(200).json("success");
		}
	});
});

function updateCol(table, id, col, new_val, callback) {
	console.log("UPDATE " + table + " SET " + col + " = " + new_val + " WHERE ID = " + id)

	var updateQuery = "update ?? set ?? = ? where id = ?";
	return db.query(updateQuery, [table, col, new_val, id], callback);
}


router.get('/profile', isAdmin, function(req, res) {
	res.json(req.user);
});


module.exports = router;


function isAdmin(req, res, next) {
	if (req.isAuthenticated()) {
		// if user type is admin
		if(req.user.type == 'admin') {
			// approved admin
			if(req.user.admin_status == '1') {
				return next();
			}
			// pending admin
			else {
				return res.render('admin-pending', {user: req.user});
			}
		}
	}
	res.redirect('/admin/login');
}

// get all cols of given 4 table names
function selectObjects(context, callback) {
	var userQuery = "select * from user;";
	var houseQuery = "select * from house;";
	var reservationQuery = "select * from reservation;";
	var visitQuery = "select * from visit;";

	var selectQuery = userQuery + houseQuery + reservationQuery + visitQuery;

	return db.query(selectQuery, callback);
}
