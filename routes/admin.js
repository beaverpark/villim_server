var express = require('express');
var router = express.Router();
var db = require('../connection');
var moment = require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");
var multer  = require('multer');
var fs = require('fs');



var storage = multer.diskStorage({
 destination: function (req, file, cb) {

 	var relative_path = './public/uploads/house_pics/' + req.body.id;
 	// if directory doesn't exist, create it
 	if(!fs.existsSync(relative_path)) {
 		fs.mkdirSync(relative_path);
 	}

    cb(null, relative_path);
  },
  filename: function (req, file, cb) {
    cb(null,  file.originalname)
  }
});
var upload = multer({storage:storage});


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


router.get('/my-page', isAdmin, function(req, res) {

	var context = {};

	getHouseList(function(err, rows) {
		if(err) console.log(err);

		// 1. all house basic infos 
		context['house_list'] = JSON.parse(JSON.stringify(rows))[0];

		// 2. all house's images
		var house_images_list = JSON.parse(JSON.stringify(rows))[1];
		// house_images = json (key: house id -> val: list of images
		var house_images = {};
		for(var i in house_images_list) {
			var house_img_obj = house_images_list[i];
			var imgs_list = (house_img_obj.images).split(",");
			house_images[house_img_obj.house_id] = imgs_list;
		}
		context['house_images'] = house_images;

		// 3. all house's amenities
		var house_amenities_list = JSON.parse(JSON.stringify(rows))[2];
		var house_amenities = {};
		for(var j in house_amenities_list) {
			var house_amen_obj = house_amenities_list[j];
			var amenities_list = (house_amen_obj.amenities).split(",");
			house_amenities[house_amen_obj.house_id] = amenities_list;
		}
		context['house_amenities'] = house_amenities;

		// 4. amenities objects
		context['amenities'] = JSON.parse(JSON.stringify(rows))[3];

		console.log(context)
		res.render('admin-my-page', context);
	});
});

function getHouseList(callback) {
	var selectQuery = "select * from house;";
	selectQuery += "select house_id, group_concat(image) as images from house_images group by house_id;";
	selectQuery += "select house_id, group_concat(amenities_id) as amenities from house_amenities group by house_id;"
	selectQuery += "select * from amenities";

	return db.query(selectQuery, callback);
}



		// 	selectHouseById(req.params.id, function(err, rows) {
		// 		if(err) console.log(err);

		// 		else {
		// 			context['house_info'] = JSON.parse(JSON.stringify(rows))[0][0];
		// 			context['amenities_list'] = JSON.parse(JSON.stringify(rows))[1];
		// 			context['house_pics_list'] = JSON.parse(JSON.stringify(rows))[2];

		// 			res.render('house_detail', context);
		// 		}
		// 	});
		// });

		// function selectHouseById(house_id, callback) {
		// 	var houseQuery = "select distinct house.id as house_id, name as house_name, addr_full, addr_summary, addr_direction, description, type as house_type, num_guest, num_bedroom, num_bed, num_bathroom, monthly_rate, daily_rate, format(utility_fee,0) as utility_fee, format(cleaning_fee,0) as cleaning_fee, latitude, longitude, house_policy, cancellation_policy, main_image, rating_overall as house_rating, review_count as house_review_count from house left join house_rating on house.id = house_rating.house_id where house.id = ?;";
		// 	var amenitiesQuery = "select name, icon_image from amenities inner join house_amenities on amenities.id = house_amenities.amenities_id where house_id = ?;";
		// 	var imageQuery = "select image from house_images where house_id = ?";

		// 	return db.query(houseQuery + amenitiesQuery + imageQuery, [house_id, house_id, house_id], callback);
		// };


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



// AJAX POST update house 
router.post('/updateHouse', isAdmin, upload.fields([{name:'main_image', maxCount:1},{name:'other_images', maxCount:30}]), function(req, res) {
	console.log("update house")

	var txt_data = req.body;
	var house_id = txt_data.id;
	// console.log(req.files)

	delete txt_data.id;
	delete txt_data.amenities1; delete txt_data.amenities2; delete txt_data.amenities3; delete txt_data.amenities4;
	delete txt_data.amenities5; delete txt_data.amenities6; delete txt_data.amenities7; delete txt_data.amenities8;
	delete txt_data.amenities9; delete txt_data.amenities10; delete txt_data.amenities11; delete txt_data.amenities12;
	delete txt_data.amenities13; delete txt_data.amenities14; delete txt_data.amenities15; delete txt_data.amenities16;
	delete txt_data.amenities17; delete txt_data.amenities18; 

	// TODO: update this list if additional amenities gets added to the db
	var amenitiesList = [req.body.amenities1, req.body.amenities2, req.body.amenities3, req.body.amenities4, req.body.amenities5, req.body.amenities6,
						req.body.amenities7, req.body.amenities8, req.body.amenities9, req.body.amenities10, req.body.amenities11, req.body.amenities12,
						req.body.amenities13, req.body.amenities14, req.body.amenities15, req.body.amenities16, req.body.amenities17, req.body.amenities18];

	// save the selected amenities into list  
	var house_amenities_list = [];
	for(var i=0; i<amenitiesList.length; i++) {
		if(amenitiesList[i] == "on") {
			house_amenities_list.push(i + 1);
		}
	}
	

	var main_image_url = "";
	var main_image = req.files['main_image'];
	if(typeof main_image !== 'undefined') {
	 	// relative_path is sth like 'public/uploads/house_pics/1'

	 	// TODO
	 	// server ver
	 	// var path = 'http://175.207.29.19/uploads/house_pics/' + req.body.id;

	 	// local ver                                uploads/house_pics/1
	 	main_image_url = 'http://localhost:3000/' + main_image[0].path.substring(7);

		txt_data['main_image'] = main_image_url;
	}

	var house_images_list = [];
	var other_images = req.files['other_images'];
	if(typeof other_images !== 'undefined') {
		for(var img in other_images) {

		 	// TODO
		 	// server ver
		 	// var path = 'http://175.207.29.19/uploads/house_pics/' + req.body.id;

		 	// local ver                                uploads/house_pics/1
	 		house_images_list.push('http://localhost:3000/' + other_images[img].path.substring(7));
		}
	}
	// console.log(house_images_list);
	// console.log(txt_data)

	updateHouse(house_id, txt_data, house_images_list, house_amenities_list, function(err, rows) {
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

function updateHouse(id, txt_data, house_images_list, house_amenities_list, callback) {

	var updateQuery = "update house set ";
	for(var key in txt_data) {
		updateQuery += key + " = '" + txt_data[key] + "',";
	}
	updateQuery = updateQuery.slice(0, -1); // get rid of last comma
	updateQuery += " where id = " + id + ";"; 

	var insertQuery = "";
	for(var i in house_images_list) {
		insertQuery += "insert into house_images (house_id, image) values (" + id + ",'" + house_images_list[i] + "');";
	}

	// TODO: deal with update / insert 
	// for(var j in house_amenities_list) {
	// 	insertQuery += "insert into house_amenities (house_id, amenities_id) values (" + id + ",'" + house_amenities_list[j] + "');";
	// }


	return db.query(updateQuery + insertQuery, callback);
}




// GET house register page
router.get('/register', isAdmin, function(req, res) {
	var context = {};

	context['user'] = req.user;

	selectAmenities(function(err, rows) {
		if(err) {
			res.json(err);
		}

		else {
			context['amenities'] = JSON.parse(JSON.stringify(rows));
			res.render('register', context);
		}
	});
});


function selectAmenities(callback) {
	var selectQuery = "select * from amenities";
	return db.query(selectQuery, callback);
}


// POST register house
router.post('/register', isAdmin, function(req, res) {

	console.log(req.body)
	var house_context = {};

	house_context['user_id'] = req.user.id; 
	house_context['name'] = req.body.house_name;
	house_context['addr_full'] = req.body.addr_full;
	house_context['addr_summary'] = req.body.addr_summary;
	// house_context['addr_direction'] = req.body.
	// house_context['description'] = req.body.
	house_context['room_type'] = req.body.house_type;
	house_context['num_guest'] = req.body.num_guest;
	house_context['num_bedroom'] = req.body.num_bedroom;
	house_context['num_bed'] = req.body.num_bed;
	house_context['num_bathroom'] = req.body.num_bathroom;
	// house_context['daily_rate'] = req.body.
	house_context['monthly_rate'] = req.body.monthly_rate;
	house_context['deposit'] = req.body.deposit;
	house_context['cleaning_fee'] = req.body.cleaning_fee;
	house_context['utility_fee'] = req.body.utility_fee;
	house_context['created'] = moment().format("YYYY-MM-DD HH:MM:SS");

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
		if(err) console.log(err);

		console.log("register house successful");

		var houseAmenities_context = {};

		houseAmenities_context['house_id'] = rows.insertId;
		houseAmenities_context['amenities'] = house_context.amenities;
		houseAmenities_context['created'] = house_context.created;

		// link house and its amenities 
		insertHouseAmenities(houseAmenities_context, function(err, rows) {
			if(err) console.log(err);

			console.log("register house amenities successful");
			res.redirect('register');
		});
	});
});

// insert new house into house table 
function insertHouse(h, callback) {
	var insertQuery = "insert into house (admin_id, name, addr_full, addr_summary, type, num_guest, num_bedroom, num_bed, num_bathroom, monthly_rate, deposit, cleaning_fee, utility_fee, created) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
	return db.query(insertQuery, [h.user_id, h.name, h.addr_full, h.addr_summary, h.room_type, h.num_guest, h.num_bedroom, h.num_bed, h.num_bathroom, h.monthly_rate, h.deposit, h.cleaning_fee, h.utility_fee, h.created], callback); 
}

// insert(link) house and its amenities into house_amenities table  
// 		houseAmenities_context = {house_id, amenities, created}
// 		amenities = list of amenities ids [1,3,4,5]
function insertHouseAmenities(houseAmenities_context, callback) {
	var insertQuery = "insert into house_amenities (house_id, amenities_id, created)";
	var values = [];

	var insertValues = " values (?,?,?)";
	values.push(houseAmenities_context.house_id);
	values.push(houseAmenities_context.amenities[0]);
	values.push(houseAmenities_context.created);

	for(var i=1; i<houseAmenities_context.amenities.length; i++) {
		insertValues += ",(?,?,?)";
		values.push(houseAmenities_context.house_id);
		values.push(houseAmenities_context.amenities[i]);
		values.push(houseAmenities_context.created);
	}
	insertValues += ";";

	return db.query(insertQuery + insertValues, values, callback);
}






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
