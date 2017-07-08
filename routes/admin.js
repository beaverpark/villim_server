var express = require('express');
var router = express.Router();
var db = require('../connection');
var moment = require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");


// GET admin page
router.get('/', isAdmin, function(req, res) {
	var context = {};

	context['user'] = req.user;

	// get all cols from user, house ,reservation, amenities table
	selectAllObjects4("user", "house", "reservation", "amenities", context, function(err, rows) {
		if(err) res.json(err);

		else {
			context['all_users'] = JSON.parse(JSON.stringify(rows[0]));
			context['all_houses'] = JSON.parse(JSON.stringify(rows[1]));
			context['all_reservations'] = JSON.parse(JSON.stringify(rows[2]));
			context['all_amenities'] = JSON.parse(JSON.stringify(rows[3]));

			res.render('admin-dashboard', context);
		}
	});
});


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
function selectAllObjects4(obj1, obj2, obj3, obj4, context, callback) {
	return db.query("select * from ??; select * from ??; select * from ??; select * from ??", [obj1, obj2, obj3, obj4], callback);
}
