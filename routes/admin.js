var express = require('express');
var router = express.Router();
var db = require('../connection');
var moment = require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");
var multer  = require('multer');
var fs = require('fs');

var defs = require('../data/defs');


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

		// 5. replace house_type, room_type (tinyint) with actual names 
		context['house_types'] = JSON.parse(JSON.stringify(rows))[4];


		// console.log(context)
		res.render('admin-my-page', context);
	});
});

function getHouseList(callback) {
	var selectQuery = "select * from house;";
	selectQuery += "select house_id, group_concat(image) as images from house_images group by house_id;";
	selectQuery += "select house_id, group_concat(amenities_id) as amenities from house_amenities group by house_id;"
	selectQuery += "select * from amenities;";
	selectQuery += "select id, house_type, room_type, (case when house_type = 0 then '일반주택' when house_type = 1 then '오피스텔' when house_type = 2 then '레지던스' end) as house_type_string, (case when room_type = 0 then '원룸' end) as room_type_string from house";


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
	var amenities_list = req.body.amenities; // list of selected amenities 
	delete req.body.amenities;

	var txt_data = req.body;
	var house_id = txt_data.id;

	console.log("update house " + house_id)

	// get the main image
	var main_image_url = "";
	var main_image = req.files['main_image'];
	if(typeof main_image !== 'undefined') {
	 	// relative_path is sth like 'public/uploads/house_pics/1'

	 	// TODO

	 	// local ver                                uploads/house_pics/1
	 	// main_image_url = 'http://localhost:3000/' + main_image[0].path.substring(7);

	 	// server ver
	 	main_image_url = 'http://175.207.29.19/' + main_image[0].path.substring(7);


		txt_data['main_image'] = main_image_url;
	}

	// get other house images
	var images_list = [];
	var other_images = req.files['other_images'];
	if(typeof other_images !== 'undefined') {
		for(var img in other_images) {

		 	// TODO

		 	// local ver                                uploads/house_pics/1
	 		// images_list.push('http://localhost:3000/' + other_images[img].path.substring(7));

		 	// server ver
	 		images_list.push('http://175.207.29.19/' + other_images[img].path.substring(7));

		}
	}

	updateHouseById(house_id, txt_data, images_list, function(err, rows) {
		if(err) {
			console.log("update house err: " + err) 
			res.status(400).json(err);
		}

		else {
			console.log("update 1 success");

			var original_amenities_list = JSON.parse(JSON.stringify(rows))[1];

			// create json of original amenity ids
			var original_json = {};
			for(var i in original_amenities_list) {
				var	a_id = original_amenities_list[i].amenities_id;
				original_json[a_id] = '';
			}

			// create json of new amenity ids 
			var new_json = {};
			for(var i in amenities_list) {
				var a_id = amenities_list[i];
				new_json[a_id] = '';
			}
			
			var insert_list = [];
			var delete_list = [];
			// for each existing amenity id, check both arrays
			// and create insert_list and delete_list
			for(var i = 1; i <= defs.num_amenities; i++) {
				// if original has it but new one doesn't
				// add it to delete_list
				if(i in original_json && !(i in new_json)) {
					delete_list.push(i);
				}

				// if new one has it but original doesn't
				// add it to insert_list 
				else if(i in new_json && !(i in original_json)) {
					insert_list.push(i);
				}
				// otherwise, no need to do anything
			}

			var created = moment().format("YYYY-MM-DD HH:MM:SS");

			updateAmenities(house_id, insert_list, delete_list, created, function(err, rows) {
				if(err) {
					console.log("update amenities err: " + err) 
					res.status(400).json(err);
				}

				else {
					console.log("update 2 success");
					res.status(200).json("success");
				}
			});
		}
	});
});

function updateAmenities(house_id, insert_list, delete_list, created, callback) {

	var insertQuery = "";
	if(insert_list.length > 0) {
		insertQuery = "insert into house_amenities (house_id, amenities_id, created) values ";
		for(var i in insert_list) {
			insertQuery += "("+ house_id +","+ insert_list[i] +",'"+ created +"'),";
		}
		insertQuery = insertQuery.slice(0,-1) + ";";
	}

	var deleteQuery = "";
	if(delete_list.length > 0) {
		deleteQuery = "delete from house_amenities where (house_id, amenities_id) in (";
		for(var i in delete_list) {
			deleteQuery += "("+ house_id +","+ delete_list[i] +"),";
		}
		deleteQuery = deleteQuery.slice(0,-1) + ");";		
	}

	var query = insertQuery + deleteQuery;

	if(query == "") {
		callback();
	}
	else {
		return db.query(query, callback);
	}
}


function updateHouseById(id, txt_data, images_list, callback) {

	var updateQuery = "update house set ";
	for(var key in txt_data) {
		updateQuery += key + " = '" + txt_data[key] + "',";
	}
	updateQuery = updateQuery.slice(0, -1); // get rid of last comma
	updateQuery += " where id = " + id + ";"; 

	var insertQuery = "";
	for(var i in images_list) {
		insertQuery += "insert into house_images (house_id, image) values (" + id + ",'" + images_list[i] + "');";
	}

	var selectQuery = "select amenities_id from house_amenities where house_id = ?";

	// TODO: deal with update / insert 
	// for(var j in house_amenities_list) {
	// 	insertQuery += "insert into house_amenities (house_id, amenities_id) values (" + id + ",'" + house_amenities_list[j] + "');";
	// }


	return db.query(updateQuery + insertQuery + selectQuery, [id], callback);
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

	var house_context = {};

	house_context['host_id'] = req.body.host_id; 
	house_context['complex_name'] = req.body.complex_name;
	house_context['name'] = req.body.name;

	house_context['house_type'] = req.body.house_type;
	house_context['room_type'] = req.body.room_type;

	house_context['num_guest'] = req.body.num_guest;
	house_context['num_bedroom'] = req.body.num_bedroom;
	house_context['num_bed'] = req.body.num_bed;
	house_context['num_bathroom'] = req.body.num_bathroom;

	house_context['addr_province'] = req.body.addr_province;
	house_context['addr_city'] = req.body.addr_city;
	house_context['addr_district'] = req.body.addr_district;
	house_context['addr_dong'] = req.body.addr_dong;
	house_context['addr_road'] = req.body.addr_road;

	house_context['addr_direction'] = req.body.addr_direction;
	house_context['description'] = req.body.description;

	house_context['monthly_rate'] = req.body.monthly_rate;
	house_context['deposit'] = req.body.deposit;
	house_context['cleaning_fee'] = req.body.cleaning_fee;
	house_context['utility_fee'] = req.body.utility_fee;
	house_context['house_policy'] = req.body.house_policy;

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

	console.log(house_context)
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
	var insertQuery = "insert into house (user_id, complex_name, name, house_type, room_type, num_guest, num_bedroom, num_bed, num_bathroom, addr_province, addr_city, addr_district, addr_dong, addr_road, addr_direction, description, monthly_rate, deposit, cleaning_fee, utility_fee, created) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
	return db.query(insertQuery, [h.host_id, h.complex_name, h.name, h.house_type, h.room_type, h.num_guest, h.num_bedroom, h.num_bed, h.num_bathroom, h.addr_province, h.addr_city, h.addr_district, h.addr_dong, h.addr_road, h.addr_direction, h.description, h.monthly_rate, h.deposit, h.cleaning_fee, h.utility_fee, h.created], callback); 
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
