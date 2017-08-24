// andriod module

var express = require('express');
var router = express.Router();
var db = require('../connection');
var moment = require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");
var async = require('async');
var multer  = require('multer')

// var mqtt = require('mqtt')
// var client = mqtt.connect('mqtt://127.0.0.1:1883')
// client.on('connect', function () {
// 	client.subscribe('doorlock');
// 	client.subscribe('doorlock_pw_set');
// 	client.subscribe("doorlock_success");

// })


var storage = multer.diskStorage({
 destination: function (req, file, cb) {
    cb(null, './public/uploads/profile_pics')
  },
  filename: function (req, file, cb) {
    cb(null,  file.originalname + '.png')
  }
});
var upload = multer({storage:storage});

function stringToList(stringList) {
	return stringList.split(',').map(Number);
}

function stringToListStr(stringList) {
	return stringList.split(',');
}

function userInfo(req) {
	var userInfo = {
		id: req.user.id,
		mobile_num: req.user.mobile_num,
		email: req.user.email,
		fullname : req.user.lastname + req.user.firstname,
		firstname: req.user.firstname,
		lastname: req.user.lastname, 
		sex: req.user.sex, 
		phone_number: req.user.phone_number, 
		date_of_birth: req.user.date_of_birth, 
		about: req.user.about,
		host: req.user.is_host,
		// status: req.user.status,
		profile_pic_url: req.user.profile_pic_url,
		push_notifications: req.user.push_notifications,
		preferred_currency: req.user.pref_currency,
		preferred_language: req.user.pref_language,
		city_of_residence: req.user.city_of_residence
	};
	return userInfo; 
};

// get user's full info 
function getUserInfo(req, result) {
	var tasks = {};
	var user_info = userInfo(req);
	var user_id = user_info.id;

	// Task 1
	// get all the house ids that the user is hosting 
	var selectHosingHouses_task = function(callback) {
		selectHostingHouses(user_id, function(err, rows) {
			if(err) return callback(err);			

			var house_id_hosting = JSON.parse(JSON.stringify(rows))[0].house_id_hosting;
			if(house_id_hosting != null) {
				var house_id_hosting_list = stringToList(house_id_hosting);
				user_info['house_id_hosting'] = house_id_hosting_list;
			}
			else {
				user_info['house_id_hosting'] = [];
			}
			// console.log('1')
			// console.log(user_info)
			callback();
		});
	};
	// Task 2
	// get all the house ids of current or past reservations
	var selectUserAllReservation_task = function(callback) {
		selectUserAllReservation(user_id, function(err, rows) {
			if(err) return callback(err);			

			// reservation 1: confirmed, 2: staying, 3: done
			var reservation_info = JSON.parse(JSON.stringify(rows))[0];

			if(reservation_info.confirmed_list != null) {
				user_info['house_id_confirmed'] = stringToList(reservation_info.confirmed_list);
			}
			else {
				user_info['house_id_confirmed'] = [];
			}
			if(reservation_info.staying_list != null) {
				user_info['house_id_staying'] = parseInt(reservation_info.staying_list);  // single int value
			}
			else {
				user_info['house_id_staying'] = null;
			}
			if(reservation_info.done_list != null) {
				user_info['house_id_done'] = stringToList(reservation_info.done_list);
			}
			else {
				user_info['house_id_done'] = [];
			}
			// console.log('2')
			// console.log(user_info)
			callback();
		});
	};
	// Task 3
	// get all the house ids of current or past visit requests
	var selectUserVisits_task = function(callback) {
		selectUserVisits(user_id, function(err, rows) {
			if(err) return callback(err);			

			// visit status - 0: pending, 1: confirmed, 2: done
			var visit_info = JSON.parse(JSON.stringify(rows))[0];
			if(visit_info.pending_list != null) {
				user_info['visit_house_id_pending'] = stringToList(visit_info.pending_list);
			}
			else {
				user_info['visit_house_id_pending'] = [];
			}
			if(visit_info.confirmed_list != null) {
				user_info['visit_house_id_confirmed'] = stringToList(visit_info.confirmed_list);
			}
			else {
				user_info['visit_house_id_confirmed'] = [];
			}
			if(visit_info.done_list != null) {
				user_info['visit_house_id_done'] = stringToList(visit_info.done_list);
			}
			else {
				user_info['visit_house_id_done'] = [];
			}
			// console.log('3')
			// console.log(user_info)
			callback();
		});
	};

	// Adding tasks 
	// if user is host to one or more houses, add task 1 to task pool 
	if(req.user.is_host) {
		tasks['task1'] = selectHosingHouses_task;
	}
	else user_info['house_id_hosting'] = [];
	// if user is not a 'reservation newcomer' (if user has active reservation or reservations in the past), add task 2 to task pool
	if(!req.user.r_newcomer) {
		tasks['task2'] = selectUserAllReservation_task;
	}
	else {
		user_info['house_id_confirmed'] = [];
		user_info['house_id_staying'] = null;
		user_info['house_id_done'] = [];
	}
	// if user is not a 'visit newcomer' (if user has active visit request or requests in the past)
	if(!req.user.v_newcomer) {
		tasks['task3'] = selectUserVisits_task;
	}
	else {
		user_info['visit_house_id_pending'] = [];
		user_info['visit_house_id_confirmed'] = [];
		user_info['visit_house_id_done'] = [];
	}
	// call query tasks in parallel 
	async.parallel(tasks, function(err) {
		if(err) {
			console.log(err);
			return result(-1); 
		}
		return result(user_info);
	});
};

// TODO: efficiency? merge these three queries into one ?
// selects user's all house ids of current and past reservations 
function selectUserAllReservation(user_id, callback) {
	var selectQuery = "select group_concat(CASE when reservation.status = 1 then reservation.house_id end) as confirmed_list,"
						+ "group_concat(CASE when reservation.status = 2 then reservation.house_id end) as staying_list,"
						+ "group_concat(CASE when reservation.status = 3 then reservation.house_id end) as done_list "
						+ "from reservation where user_id = ? group by user_id";

	return db.query(selectQuery, [user_id], callback);
};

// selects user's all house ids of current and past visits
function selectUserVisits(user_id, callback) {
	var selectQuery = "select group_concat(CASE when visit.status = 0 then visit.house_id end) as pending_list,"
						+ "group_concat(CASE when visit.status = 1 then visit.house_id end) as confirmed_list,"
						+ "group_concat(CASE when visit.status = 2 then visit.house_id end) as done_list "
						+ "from visit where user_id = ? group by user_id";
	return db.query(selectQuery, [user_id], callback);
};

// select user's hosting house ids 
function selectHostingHouses(user_id, callback) {
	var selectQuery = "select group_concat(house.id) as house_id_hosting from house where user_id = ?";
	return db.query(selectQuery, [user_id], callback);
};


// get host's full info 
function getHostInfo(host_id, result) {
	selectHostById(host_id, function(err, rows) {
		if(err) {
			console.log(err);
			return result(-1);
		}
		var host_info = JSON.parse(JSON.stringify(rows))[0];

		if(typeof host_info === 'undefined') {
			console.log("host id doesn't exist");
			return result(-1);
		}
		return result(host_info);
	});
};

function selectHostById(host_id, callback) {
	var selectQuery = "select u.id as host_id, concat(u.lastname, u.firstname) as host_name, u.about, u.profile_pic_url as host_profile_pic_url, h.rating as host_rating, h.review_count as host_review_count from user u inner join host h on u.id = h.id where u.id = ?";
	return db.query(selectQuery, [host_id], callback);
};

// get house's full info  
function getHouseInfo(house_id, result) {
	selectHouseById(house_id, function(err, rows) {
		if(err) {
			console.log(err);
			return result(-1);
		}
		var house_info = JSON.parse(JSON.stringify(rows))[0];

		if(typeof house_info === 'undefined') {
			console.log("house id doesn't exist");
			return result(-1);
		}
		return result(house_info);
	});
};

function selectHouseById(house_id, callback) {
	var selectQuery = "select house.id as house_id, house.user_id as host_id, name as house_name, addr_full, addr_summary, addr_direction, description, type as house_type, num_guest, num_bedroom, num_bed, num_bathroom, monthly_rate as rate_per_month, daily_rate as rate_per_night, utility_fee, cleaning_fee, latitude, longitude, house_policy, cancellation_policy, main_image as house_thumbnail_url, rating_overall as house_rating, review_count as house_review_count from house inner join house_rating on house.id = house_rating.house_id where house.id = ?";
	return db.query(selectQuery, [house_id], callback);
};

// get house's latest review  (review 가 없을때 대)
function getLatestReview(house_id, result) {
	selectLatestReviewByHouseId(house_id, function(err, rows) {
		if(err) {
			console.log(err);
			return result(-1);
		}
		var latest_review_info = JSON.parse(JSON.stringify(rows))[0];
		// if review doesn't exist
		if(typeof latest_review_info === 'undefined') {
			latest_review_info = {'review_last_reviewer': null, 'review_last_content': null, 'review_last_rating': null, 'review_last_profile_pic_url': ''};
		}
		return result(latest_review_info);
	});
};

// TODO: query 다시 보기
function selectLatestReviewByHouseId(house_id, callback) {
	var selectQuery = "select concat(u.lastname, u.firstname) as review_last_reviewer, r.comment as review_last_content, r.rating_overall as review_last_rating, u.profile_pic_url as review_last_profile_pic_url from review r right outer join user u on r.commenter_id = u.id where r.house_id = ? order by r.created desc limit 1";
	return db.query(selectQuery, [house_id], callback);
}

function getHouseAmenities(house_id, result) {
	selectHouseAmenities(house_id, function(err, rows) {
		if(err) {
			console.log(err);
			return result(-1);
		}
		var amenities = JSON.parse(JSON.stringify(rows))[0];
		// console.log(amenities)
		// TODO: 여기서 house_id 가 없어도 null, amenities가 없어도 null임. 에러 differentiate하게만들어야함 
		if(amenities.amenity_ids != null) {
			var amenities_list = stringToList(amenities.amenity_ids);
		}
		else {
			var amenities_list = [];
		}
		return result(amenities_list)
	});
};

function selectHouseAmenities(house_id, callback) {
	var selectQuery = "select group_concat(amenities_id) as amenity_ids from house_amenities where house_id = ?";
	return db.query(selectQuery, [house_id], callback);
}


function getHousePics(house_id, result) {
	selectHousePics(house_id, function(err, rows) {
		if(err) {
			console.log(err);
			return result(-1);
		}
		var house_pics = JSON.parse(JSON.stringify(rows))[0];

		if(house_pics.house_pic_urls != null) {
			var house_pics_list = stringToListStr(house_pics.house_pic_urls);
		}
		else {
			var house_pics_list = [];
		}
		return result(house_pics_list);

	});
};

function selectHousePics(house_id, callback) {
	var selectQuery = "select group_concat(image) as house_pic_urls from house_images where house_id = ?";
	return db.query(selectQuery, [house_id], callback);
}

// 3. 유저 화면 - get user info about currently logged in user
router.get('/user-info', function(req, res) {	
	// console.time("test");
	if (!req.isAuthenticated()) {
		return res.json({success: false , message: "user not logged in.", user_info: null});
	}

	// get user's full info 
	getUserInfo(req, function(user_info) {
		if(user_info == -1) {
			return res.json({success: false , message: "서버가 불안정합니다."});
		}
		console.log(user_info)
		return res.json({success: true, message: null, user_info});
	}); 
});


// 4. 프로필 변경하기 (POST) - update user's profile 
router.post('/update-profile', upload.single('profile_pic'), function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({success: false, message: "user not logged in."});
	}
	var new_profile = {};

	new_profile['firstname'] = req.body.firstname;
	new_profile['lastname'] = req.body.lastname;
	// new_profile['sex'] = req.query.sex;
	new_profile['email'] = req.body.email; 
	new_profile['phone_number'] = req.body.phone_number;
	new_profile['about'] = req.body.about; 
	// new_profile['pref_currency'] = req.body.pref_currency;
	// new_profile['pref_language'] = req.body.pref_language;
	new_profile['city_of_residence'] = req.body.city_of_residence;

	// TODO: this is just for local storage. 
	// make profile url path  http://175.207.29.19/uploads/profile_pics/user1_profile.png
	// console.log(req.user.profile_pic_url);

	new_profile['profile_pic_url'] = req.user.profile_pic_url;

	if(typeof req.file !== 'undefined') {
		var temp_url = req.file.path.slice(7);
		// TODO: change the url to villim.com 
		var profile_pic_url = "http://175.207.29.19/" + temp_url; 
		new_profile['profile_pic_url'] = profile_pic_url;		
	}

	console.log(new_profile['profile_pic_url'])

	console.log(new_profile)
	if(req.body.push_notifications) {
		new_profile['push_notifications'] = 1;
	}

	else {
		new_profile['push_notifications'] = 0;
	}

	updateProfile(req.user.id, new_profile, function(err, rows) {
		if(err) {
			console.log(err)
			return res.json({success: false , message: "서버가 불안정합니다."});			
		}

		// update successful
		// redirect to getting user's changed full info (to update req)
		res.redirect('/a/user-info');
	});

});

function updateProfile(user_id, new_profile, callback) {
	var update_user = "update user set firstname = ?, lastname = ?, email = ?, phone_number = ?, about = ?, city_of_residence = ?, push_notifications = ?, profile_pic_url = ? where id = ?";
	return db.query(update_user, [new_profile.firstname, new_profile.lastname, new_profile.email, new_profile.phone_number, new_profile.about, new_profile.city_of_residence, new_profile.push_notifications, new_profile.profile_pic_url, user_id], callback);
};


// 5. 호스트 화면 - get host info about currently selected house 
router.get('/host-info', function(req, res) {
	var host_id = req.query.host_id;

	// get user's full info 
	getHostInfo(host_id, function(host_info) {
		if(host_info == -1) {
			return res.json({success: false , message: "서버가 불안정합니다."});
		}
		host_info['success'] = true;
		host_info['message'] = null;
		console.log(host_info)
		return res.json(host_info);
	}); 
});


// 6. 유저의 집 화면(현재 사용하는 집 or 가장 가까운 예약 컨펌된 집) - get user's current house or confirmed house (w/ closest check-in date)
router.get('/my-house', function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({success: false , message: "user not logged in."});
	}

	// if user has never made any reservations or is not currently "reservation active", don't need to query
	if(req.user.r_newcomer || !req.user.r_active) {
		console.log("user has no active reservation");
		return res.json({success: false , message: "실패: 유저의 방이 존재하지 않습니다."});
	}

	// if user has currently staying house, query staying house reservation info
	if(req.user.staying) {
		selectUserStayingReservation(req.user.id, function(err, rows) {
			if(err) {
				console.log(err); 
				return res.json({success: false , message: "서버가 불안정합니다."});
			}

			else {
				var house_info = {};
				house_info = JSON.parse(JSON.stringify(rows))[0];

				if(typeof house_info === 'undefined') {
					return res.json({success: false , message: "서버가 불안정합니다."});
				}
				house_info['success'] = true;
				house_info['message'] = "staying";
				// console.log("currently staying house")
				// console.log(house_info)
				return res.json(house_info);
			}
		});
	}

	// if user has confirmed houses, only query the closest upcoming reservation info
	else {
		selectUserClosestConfirmedReservation(req.user.id, function(err, rows) {
			if(err) {
				console.log(err); 
				return res.json({success: false , message: "서버가 불안정합니다."});
			}

			else {
				var confirmed_house_info = {};
				confirmed_house_info = JSON.parse(JSON.stringify(rows))[0];
				confirmed_house_info['success'] = true;
				confirmed_house_info['message'] = "confirmed";
				// console.log("upcoming house")
				// console.log(confirmed_house_info)
				return res.json(confirmed_house_info);
			}
		});
	}
});

// selects user's currently staying house reservation
function selectUserStayingReservation(user_id, callback) {
	var selectQuery = "select r.id as reservation_id, r.house_id, r.checkin, r.checkout, h.name as house_name, h.main_image as house_thumbnail_url from reservation r, house h where r.house_id = h.id and r.user_id = ? and r.status = 2";
	return db.query(selectQuery, [user_id], callback);
};

// selects user's closest upcoming confirmed reservation
function selectUserClosestConfirmedReservation(user_id, callback) {
	var selectQuery = "select r.id as reservation_id, r.house_id, r.checkin, r.checkout, h.name as house_name, h.main_image as house_thumbnail_url from reservation r inner join house h on r.house_id = h.id where r.user_id = ? and r.status = 2";
	return db.query(selectQuery, [user_id], callback);
};


// 7. 집 리스트 화면 - get list of all registered houses
router.get('/featured-houses', function(req, res) {

	var pref_currency = req.params.preferred_currency;

	//TODO: currency convert 


	selectAllHouses(function(err, rows) {
		if(err) {
			console.log(err); 
			return res.json({success: false , message: "서버가 불안정합니다."});
		} 

		else {
			console.log("select houses successful");
			var context = {};
			var houses = [];

			context['house_review_count'] = JSON.parse(JSON.stringify(rows[0]));
			context['house_id'] = JSON.parse(JSON.stringify(rows[1]));
			context['house_name'] = JSON.parse(JSON.stringify(rows[2]));
			context['rate_per_night'] = JSON.parse(JSON.stringify(rows[3]));
			context['house_rating'] = JSON.parse(JSON.stringify(rows[4]));
			context['house_thumbnail_url'] = JSON.parse(JSON.stringify(rows[5]));
			context['rate_per_month'] = JSON.parse(JSON.stringify(rows[6]));

			for(var i=0; i<context['house_id'].length; i++) {
				var house = {};

				house['house_id'] = context['house_id'][i].id;
				house['house_name'] = context['house_name'][i].name;
				house['rate_per_night'] = context['rate_per_night'][i].daily_rate;
				house['rate_per_month'] = context['rate_per_month'][i].monthly_rate; 
				house['house_rating'] = context['house_rating'][i].rating_overall;
				house['house_review_count'] = context['house_review_count'][i].num_reviews;
				house['house_thumbnail_url'] = context['house_thumbnail_url'][i].main_image;
				houses.push(house);
			}
			console.log(houses);

			return res.json({success: true , message: null, houses});
		}
	});
});

function selectAllHouses(callback) {
	// house_review_count, house_id, house_name, rate_per_night, house_rating, houes_thumbnail_url
	var selectQuery = "select count(review.id) as num_reviews from house left join review on (house.id = review.house_id) group by house.id;";
	selectQuery += "select id from house; select name from house; select daily_rate as daily_rate from house; select rating_overall from house_rating; select main_image from house; select monthly_rate as monthly_rate from house";

	return db.query(selectQuery, callback);
}


// TODO: async parallel running sequentailly
// 8. 집 상세 화면 - get house info about currently selected house  
router.get('/house-info', function(req, res) {
	var house_id = req.query.house_id;
	var pref_currency = req.query.preferred_currency;

	var house_info = {};
	var tasks = {};

	var getHouseInfo_task = function(callback) {
		// get house's full info 
		getHouseInfo(house_id, function(house_result) {
			if(house_result == -1) {
				return callback(new Error("getHouseInfo err"));
			}
			// TODO: shouldn't do this when running parallel, but async parallel is running sequential :\
			house_info = house_result; 
			// console.log("1")

			// get host's full info
			getHostInfo(house_info['host_id'], function(host_info) {
				if(host_info == -1) {
					return callback(new Error("host id doesn't exist"));
				}
				for(var key in host_info) {
					house_info[key] = host_info[key];
				}
				callback();
			})
		});
	};


	var getReservedDates_task = function(callback) {
		getReservedDates(house_id, function(err, rows) {
			if(err) return callback(err);

			var dates_reserved = JSON.parse(JSON.stringify(rows));

			// console.log("2")
			// console.log(dates_reserved)
			house_info['reservations'] = dates_reserved;

			callback();
		});
	};

	var getLatestReview_task = function(callback) {
		getLatestReview(house_id, function(review) {
			if(review == -1) {
				return callback(new Error("getLatestReview err"));
			}
			// console.log("3")
			// console.log(review)
			for(var key in review) {
				house_info[key] = review[key];
			}
        	callback();
		});
	};


	var getHouseAmenities_task = function(callback) {
		getHouseAmenities(house_id, function(amenities) {
			if(amenities == -1) {
				return callback(new Error("getHouseAmenities err"));
			}
			// console.log("4")
			// console.log(amenities)
			house_info['amenity_ids'] = amenities;
			callback();
		});
	};

	var getHousePics_task = function(callback) {
		getHousePics(house_id, function(pics) {
			if(pics == -1) {
				return callback(new Error("getHousePics err"));
			}
			// console.log("5")
			// console.log(pics)
			house_info['house_pic_urls'] = pics;
			callback();
		});
	};

	// add tasks
	tasks['task1'] = getHouseInfo_task;
	tasks['task2'] = getReservedDates_task;
	tasks['task3'] = getLatestReview_task;
	tasks['task4'] = getHouseAmenities_task;
	tasks['task5'] = getHousePics_task;

	// call query tasks in parallel 
	async.parallel(tasks, function(err) {
		if(err) {
			console.log(err);
			return res.json({success: false , message: "서버가 불안정합니다."});
		}
		// console.log(house_info)
		return res.json({success: true , message:null, house_info});
	});
});

function getReservedDates(house_id, callback) {
	var selectQuery = "select checkin, checkout from reservation where house_id = ? order by checkin";
	return db.query(selectQuery, [house_id], callback);
}


// 9. 집 후기 화면 - get all the review info about currently selected house
router.get('/house-reviews', function(req, res) {
	var house_id = req.query.house_id;
	var tasks = {};
	var context = {};
	// Task 1
	// get the avg ratings of the house 
	var selectHouseRating_task = function(callback) {
		selectHouseRating(house_id, function(err, rows) {
			if(err) return callback(err);

			// if given house_id doesn't exist, return error  
			context = JSON.parse(JSON.stringify(rows))[0];
			if(typeof context === "undefined") {
				return callback(new Error("house_id doesn't exist"));
			}
			context['house_id'] = Number(house_id); // manually add house_id
			callback();
		});
	};

	// Task 2
	// get all reviews of the house 
	var selectAllReviewsByHouseId_task = function(callback) {
		selectAllReviewsByHouseId(house_id, function(err, rows) {
			if(err) return callback(err);

			var reviews = JSON.parse(JSON.stringify(rows));

			for(var i=0; i<reviews.length; i++) {
				reviews[i]['house_id'] = Number(house_id); // manually add house_id
				reviews[i]['host_id'] = context.host_id; // manually add host_id
			}
			context['reviews'] = reviews;
			callback();
		});
	};

	// add tasks
	tasks['task1'] = selectHouseRating_task;
	tasks['task2'] = selectAllReviewsByHouseId_task;

	// call query tasks in series 
	async.series(tasks, function(err) {
		if(err) {
			console.log(err);
			return res.json({success: false , message: "서버가 불안정합니다."});
		}
		context['success'] = true;
		context['message'] = null;
		console.log(context)
		return res.json(context);
	});
});

function selectHouseRating(house_id, callback) {
	// house_id 위에서 add
	var house_rating_query = "select rating_overall, rating_accuracy, rating_communication, rating_cleanliness, rating_location, rating_checkin, rating_value, user_id as host_id from house_rating inner join house on house_rating.house_id = house.id where house_id = ?"
	return db.query(house_rating_query, [house_id], callback);
}

function selectAllReviewsByHouseId(house_id, callback) {
	// house_id, host_id 위에서 add 
	var house_reviews_query = "select commenter_id as reviwer_id, reservation_id, concat(lastname,firstname) as reviewer_name, comment as review_content, profile_pic_url as reviewer_profile_pic_url, (case when review.modified is null then review.created else review.modified end) as review_date, rating_overall, rating_accuracy, rating_communication, rating_cleanliness, rating_location, rating_checkin, rating_value from review inner join user on review.commenter_id = user.id where house_id = ?";
	return db.query(house_reviews_query, [house_id], callback);
}

// 10. 리뷰 남기기 (POST) - post a review to selected house
router.post('/post-review', function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({success: false, message: "user not logged in."});
	}
	
	// if house_id = -1, err 
	if(req.query.house_id == -1) {
		return res.json({success: false, message: "서버가 불안정합니다."});
	}

	var house_id = req.body.house_id;
	var user_id = req.user.id;
	var tasks = {};
	var reservation_id;
	var created = moment().format("YYYY-MM-DD HH:MM:SS");

	// Task 1
	// check if current user has past reservation (status = done) at the given house
	var checkPastReservation_task = function(callback) {
		checkPastReservation(house_id, user_id, function(err, rows) {
			if(err) return callback(err);

			// if given house_id doesn't exist, return error  
			var reservation = JSON.parse(JSON.stringify(rows))[0];

			// check if user has any past reservation for given house id
			if(typeof reservation === 'undefined') {
				return callback(new Error("no matching reservation record found."));
			}

			// if user does, check if its status is 2 or 3 (done)
			if(!(reservation.status == 2 || reservation.status == 3)) {
				return callback(new Error("either user is not staying or not done staying."));
			}
			reservation_id = reservation.id; 
			// if all is well, move on to the next task
			callback();
		});
	};

	// Task 2
	// make a review for a given house
	var postReview_task = function(callback) {

		var review_info = {};
		review_info['review_con'] = req.body.review_content;
		review_info['rating_acr'] = req.body.rating_accuracy;
		review_info['rating_loc'] = req.body.rating_location;
		review_info['rating_com'] = req.body.rating_communication; 
		review_info['rating_chk'] = req.body.rating_checkin;
		review_info['rating_cln'] = req.body.rating_cleanliness; 
		review_info['rating_val'] = req.body.rating_value; 

		postReview(house_id, user_id, reservation_id, review_info, created, function(err, rows) {
			if(err) {
				return callback(err);
			}
			// successfully posted review
			console.log("successfully posted review")
			callback();
		});
	};

	// add tasks
	tasks['task1'] = checkPastReservation_task;
	tasks['task2'] = postReview_task;

	// call query tasks in series 
	async.series(tasks, function(err) {
		if(err) {
			console.log(err);
			return res.json({success: false , message: "서버가 불안정합니다."});
		}
		return res.json({success: true, message: "후기가 성공적으로 등록되었습니다."});
	});
});

function checkPastReservation(house_id, user_id, callback) {
	var check_query = "select id, status from reservation where house_id = ? and user_id = ?";
	return db.query(check_query, [house_id, user_id], callback);
}

function postReview(house_id, user_id, reservation_id, review_info, created, callback) {
	var insert_visit = "insert into review (house_id, commenter_id, reservation_id, comment, rating_accuracy, rating_communication, rating_cleanliness, rating_location, rating_checkin, rating_value, created) values (?,?,?,?,?,?,?,?,?,?,?)";
	return db.query(insert_visit, [house_id, user_id, reservation_id, review_info.review_con, review_info.rating_acr, review_info.rating_com, review_info.rating_cln, review_info.rating_loc, review_info.rating_chk, review_info.rating_val, created], callback);
};


// 11. 방문 목록 화면 - get user's confirmed visits 
router.get('/visit-list', function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({success: false, message: "user not logged in."});
	}	

	var pref_currency = req.params.preferred_currency;

	var user_id = req.user.id;
	var context = {};
	async.parallel([
			function(callback) {
				selectConfirmedVisits(user_id, function(err, rows) {
					if(err) return res.json({success: false , message: "서버가 불안정합니다."});

					var confirmed_visits = JSON.parse(JSON.stringify(rows));
					// console.log("1")
					// console.log(confirmed_visits)
					context['confirmed_visits'] = confirmed_visits;
					callback();
				});
			},

			function(callback) {
				selectPendingVisits(user_id, function(err, rows) {
					if(err) return res.json({success: false , message: "서버가 불안정합니다."});

					var pending_visits = JSON.parse(JSON.stringify(rows));
					// console.log("2")
					// console.log(pending_visits);
					context['pending_visits'] = pending_visits;
					callback()
				});
			}
		], 
		function(err) {
			if(err) {
				console.log(err);
				return res.json({success: false , message: "서버가 불안정합니다."});
			}

			else {
				context['success'] = true;
				context['message'] = null;
				console.log(context)
				return res.json(context);
			}	
		}
	);
});

// select confirmed visits (visit closest to current date is shown first)
function selectConfirmedVisits(user_id, callback) {
	var selectQuery = "select visit.id as visit_id, visit.house_id, visit.user_id as visitor_id, date_time as visit_time, name as house_name, monthly_rate as rate_per_month, daily_rate as rate_per_night, rating_overall as house_rating, review_count as house_review_count, main_image as house_thumbnail_url from visit inner join house on visit.house_id = house.id inner join house_rating on house_rating.house_id = visit.house_id where visit.user_id = ? and visit.status = 1 order by visit.date_time";
	return db.query(selectQuery, [user_id], callback);
}

// select pending visits (latest visit request is shown first)
function selectPendingVisits(user_id, callback) {
	var selectQuery = "select visit.id as visit_id, visit.house_id, visit.user_id as visitor_id, date_time as visit_time, name as house_name, monthly_rate as rate_per_month, daily_rate as rate_per_night, rating_overall as house_rating, review_count as house_review_count, main_image as house_thumbnail_url from visit inner join house on visit.house_id = house.id inner join house_rating on house_rating.house_id = visit.house_id where visit.user_id = ? and visit.status = 0 order by visit.id desc";
	return db.query(selectQuery, [user_id], callback);
}


// 12. 방문 상세 화면 - get visit info about selected visit 
router.get('/visit-info', function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({success: false, message: "user not logged in."});
	}	

	var visit_id = req.query.visit_id;

	var context = {};

	selectVisit(visit_id, function(err, rows) {
		if(err) return res.json({success: false , message: "서버가 불안정합니다."});

		var visit_info = JSON.parse(JSON.stringify(rows))[0];

		if(typeof visit_info === 'undefined') {
			console.log('no visit id found');
			return res.json({success: false , message: "서버가 불안정합니다."});
		}
		
		// console.log(visit_info);
		var house_id = visit_info['house_id'];

		getHouseInfo(house_id, function(house_info) {
			if(house_info == -1) {
				return res.json({success: false , message: "서버가 불안정합니다."});
			}
			// console.log(house_info)

			async.parallel([
					function(callback) {
						getLatestReview(house_id, function(review) {
							if(house_info == -1) {
								return res.json({success: false , message: "서버가 불안정합니다."});
							}
							// console.log("1")
							// console.log(review)
							for(var key in review) {
								house_info[key] = review[key];
							}
							callback();
						})
					},

					function(callback) {
						getHouseAmenities(house_id, function(amenities) {
							if(house_info == -1) {
								return res.json({success: false , message: "서버가 불안정합니다."});
							}
							// console.log("2")
							// console.log(amenities)
							house_info['amenity_ids'] = amenities;
							callback();
						})
					},

					function(callback) {
						getHousePics(house_id, function(pics) {
							if(house_info == -1) {
								return res.json({success: false , message: "서버가 불안정합니다."});
							}
							// console.log("3")
							// console.log(pics)
							house_info['house_pic_urls'] = pics;
							callback();
						})
					}
				], 
				function(err) {
					if(err) {
						console.log(err);
						return res.json({success: false , message: "서버가 불안정합니다."});
					}

					else {
						context['success'] = true;
						context['message'] = null;
						context['visit_info'] = visit_info;
						context['house_info'] = house_info;
						console.log(context)
						return res.json(context);
					}			
				}
			);
		});
	});
});

function selectVisit(visit_id, callback) {
	var selectQuery = "select id, house_id, user_id as visitor_id, date_time as visit_time from visit where id = ?";
	return db.query(selectQuery, [visit_id], callback);
}


// 13. 방문 신청하기 (POST) - make a visit request
router.post('/visit-request', function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({success: false, message: "user not logged in."});
	}

	var user_id = req.user.id;
	var house_id = req.body.house_id;
	var checkin = req.body.checkin; //yyyy-mm-dd
	var checkout = req.body.checkout;
	var created = moment().format("YYYY-MM-DD HH:MM:SS");

	var visit_info = {};
	visit_info['house_id'] = house_id;
	visit_info['guest_id'] = user_id;
	visit_info['checkin'] = checkin;
	visit_info['checkout'] = checkout;

	makeVisitRequest(house_id, user_id, checkin, checkout, created, function(err, rows) {
		if(err) {
			console.log(err)
			return res.json({success: false, message: "서버가 불안정합니다."});
		}
		visit_info['visit_id'] = rows.insertId;
		visit_info['visit_time'] = null; // visit time is null anyway
		visit_info['visit_created'] = created;
		visit_info['visit_status'] = 0;	// status is pending anyway

		updateUserVstatus(user_id, function(err, rows) {
			if(err) {
				console.log(err)
				return res.json({success: false, message: "서버가 불안정합니다."});
			} 

			console.log(visit_info)
			return res.json({success: true, message: "성공적으로 예약되었습니다.", visit_info});
		});
	});
});

function makeVisitRequest(house_id, user_id, checkin, checkout, created, callback) {
	var insertQuery = "insert into visit (house_id, user_id, checkin, checkout, created) values (?,?,?,?,?)";
	return db.query(insertQuery, [house_id, user_id, checkin, checkout, created], callback);
};

function updateUserVstatus(user_id, callback) {
	var updateQuery = "update user set v_active = ?, v_newcomer = ? where id = ?";
	return db.query(updateQuery, [1, 0, user_id], callback);		
}

	
//TODO
// 14. 방문 캔슬 (POST) - cancel visit request
router.post('/cancel-visit', function(req, res) {
	var visit_id = req.body.visit_id;
});


// 15. 도어락 열기 - open doorlock of currently logged in user 
router.get('/open-doorlock', function(req, res) {

	// TODO
	// JUST FOR NOWWW
			// if (!req.isAuthenticated()) {
			// 	return res.json({open_authorized: false, message: "user not logged in."});
			// }

			// // if user is not currently staying at house
			// if(!req.user.staying) {
			// 	return res.json({open_authorized: false, message: "user not currently staying in any house."});
			// }

	// TODO: doorlock logic 
	client.publish('doorlock', 'open');

	return res.json({open_authorized: true, success: true, message: null});


	// client.on('message', function(topic, message) {
	// 	console.log("topic = " + topic)
	// 	console.log("message = " + message.toString())

	// 	if(topic == "doorlock_success") {
	// 		if(message.toString() == "success") {
	// 			console.log("success")
	// 			return res.json({open_authorized: true, success: true, message: null});
	// 		}

	// 		else {
	// 			console.log("fail")
	// 			return res.json({open_authorized: false, success: false, message: "서버에 문제가 있습니다. 잠시 후 다시 시도해주시기 바랍니다."});
	// 		}
	// 	}
	// 	// return res.json({open_authorized: false, success: false, message: "서버에 문제가 있습니다. 잠시 후 다시 시도해주시기 바랍니다."});
	// })

	// if door lock fails 
	// if(doorlock fails) {
		// return res.json({open_authorized: true, open_success: false, message: "실패: 도어락이 고장났습니다."})
	// }
	// return res.json({open_authorized: false, success: false, message: "서버에 문제가 있습니다. 잠시 후 다시 시도해주시기 바랍니다."});
});


// 16. 도어락 비밀번호 변경 (POST) - change pascode for currently logged in user's house
router.post('/change-passcode', function(req, res) {

	var new_pw = req.body.passcode; 
	var new_pw2 = req.body.passcode_confirm;

	console.log("new password = " + new_pw);
	console.log("password confirm = " + new_pw2);

	if(new_pw != new_pw2) {
		return res.json({success: false, message: "두 비밀번호가 일치하지 않습니다."})
	}

	client.publish('doorlock_pw_set', new_pw);


	return res.json({success: true});
});


// 17. 비밀번호 찾기 (POST) - find user's password given user's email
router.post('/find-password', function(req, res) {
	var email = req.query.email;
	// return res.json({})
});


// 18. FAQ 화면 - get faq page
router.get('/faq', function(req, res) {
});

// 19. 개인정보 이용약관 화면 - get privacy policy page
router.get('/privacy-policy', function(req, res) {
});

// 20. 서비스 이용약관 화면 - get terms of service page
router.get('/terms-of-service', function(req, res) {
});

module.exports = router;

/************************/
/*** helper functions ***/
/************************/


/************************/
/*** QUERY functions ****/
/************************/


