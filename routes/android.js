// andriod module

var express = require('express');
var router = express.Router();
var db = require('../connection');
var moment = require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");
var async = require('async');

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
		status: req.user.status,
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
		// console.timeEnd("test");
		return result(user_info);
	});
};

// TODO: merge these three queries into one 
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
	var selectQuery = "select house.id as house_id, name as house_name, addr_full, addr_summary, addr_direction, description, type as house_type, num_guest, num_bedroom, num_bed, num_bathroom, monthly_rate as rate_per_month, daily_rate as rate_per_night, utility_fee, cleaning_fee, latitude, longitude, house_policy, cancellation_policy, main_image as house_thumbnail_url, rating_overall as house_rating, review_count as house_review_count from house inner join house_rating on house.id = house_rating.house_id where house.id = ?";
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
	var selectQuery = "select r.commenter_id as review_last_reviewer, r.comment as review_last_content, r.rating_overall as review_last_rating, u.profile_pic_url as review_last_profile_pic_url from review r right outer join user u on r.commenter_id = u.id where r.house_id = ? order by r.created desc limit 1";
	return db.query(selectQuery, [house_id], callback);
}

function getHouseAmenities(house_id, result) {
	selectHouseAmenities(house_id, function(err, rows) {
		if(err) {
			console.log(err);
			return result(-1);
		}
		var amenities = JSON.parse(JSON.stringify(rows))[0];
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
router.get('/userinfo', function(req, res) {	
	// console.time("test");
	if (!req.isAuthenticated()) {
		return res.json({query_success: false , message: "err: user not logged in.", user_info: null});
	}

	// get user's full info 
	getUserInfo(req, function(user_info) {
		if(user_info == -1) {
			return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
		}
		console.log(user_info)
		return res.json({query_success: true, message: null, user_info});
	}); 
});


// 4. 프로필 변경하기 (POST) - update uesr's profile 
router.get('/update-profile', function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({update_success: false, message: "err: user not logged in."});
	}
	var new_profile = {};
	new_profile['firstname'] = req.query.firstname;
	new_profile['lastname'] = req.query.lastname;
	new_profile['sex'] = req.query.sex;
	// new_profile['email'] = req.query.email; 
	// new_profile['phone_number'] = req.query.phone_number;
	new_profile['about'] = req.query.about; 
	// new_profile['pref_currency'] = req.query.pref_currency;
	// new_profile['pref_language'] = req.query.pref_language;
	new_profile['city_of_residence'] = req.query.city_of_residence;
	// new_profile['push_notifications'] = req.query.push_notifications;
	// new_profile['profile_pic_url'] = req.query.profile_pic; 	// multipart image

	updateProfile(req.user.id, new_profile, function(err, rows) {
		if(err) return res.json({update_success: false , message: "err: 서버가 불안정합니다."});
		// update successful

		// redirect to getting user's changed full info (to update req)
		res.redirect('/a/userinfo');
	});

});

function updateProfile(user_id, new_profile, callback) {
	var update_user = "update user set firstname = ?, lastname = ?, sex = ?, about = ?, city_of_residence = ? where id = ?";
	return db.query(update_user, [new_profile.firstname, new_profile.lastname, new_profile.sex, new_profile.about, new_profile.city_of_residence, user_id], callback);
};


// 5. 호스트 화면 - get host info about currently selected house 
router.get('/host-info', function(req, res) {
	var host_id = req.query.host_id;

	// get user's full info 
	getHostInfo(host_id, function(host_info) {
		if(host_info == -1) {
			return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
		}
		host_info['query_success'] = true;
		host_info['message'] = null;
		console.log(host_info)
		return res.json(host_info);
	}); 
});


// 6. 유저의 집 화면(현재 사용하는 집 or 가장 가까운 예약 컨펌된 집) - get user's current house or confirmed house (w/ closest check-in date)
router.get('/my-house', function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({query_success: false , message: "err: user not logged in."});
	}

	// if user has never made any reservations or is not currently "reservation active", don't need to query
	if(req.user.r_newcomer || !req.user.r_active) {
		console.log("user has no active reservation");
		return res.json({query_success: false , message: "실패: 유저의 방이 존재하지 않습니다."});
	}

	// if user has currently staying house, query staying house reservation info
	if(req.user.staying) {
		selectUserStayingReservation(req.user.id, function(err, rows) {
			if(err) {
				console.log(err); 
				return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
			}

			else {
				var house_info = {};
				house_info = JSON.parse(JSON.stringify(rows))[0];

				if(typeof house_info === 'undefined') {
					return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
				}
				house_info['query_success'] = true;
				house_info['message'] = "staying";
				console.log("currently staying house")
				console.log(house_info)
				return res.json(house_info);
			}
		});
	}

	// if user has confirmed houses, only query the closest upcoming reservation info
	else {
		selectUserClosestConfirmedReservation(req.user.id, function(err, rows) {
			if(err) {
				console.log(err); 
				return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
			}

			else {
				var confirmed_house_info = {};
				confirmed_house_info = JSON.parse(JSON.stringify(rows))[0];
				confirmed_house_info['query_success'] = true;
				confirmed_house_info['message'] = "confirmed";
				console.log("upcoming house")
				console.log(confirmed_house_info)
				return res.json(confirmed_house_info);
			}
		});
	}
});

// selects user's currently staying house reservation
function selectUserStayingReservation(user_id, callback) {
	var selectQuery = "select r.id as reservation_id, r.house_id, r.checkin_date as start_date, r.checkout_date as end_date, h.main_image as house_thumbnail_url from reservation r, house h where r.house_id = h.id and r.user_id = ? and r.status = 2";
	return db.query(selectQuery, [user_id], callback);
};

// selects user's closest upcoming confirmed reservation
function selectUserClosestConfirmedReservation(user_id, callback) {
	var selectQuery = "select r.id as reservation_id, r.house_id, r.checkin_date as start_date, r.checkout_date as end_date, h.main_image as house_thumbnail_url from reservation r inner join house h on r.house_id = h.id where r.user_id = ? and r.status = 2";
	return db.query(selectQuery, [user_id], callback);
};


// 7. 집 리스트 화면 - get list of all registered houses
router.get('/featured-houses', function(req, res) {

	selectAllHouses(function(err, rows) {
		if(err) {
			console.log(err); 
			return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
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

			return res.json({query_success: true , message: null, houses});
		}
	});
});

function selectAllHouses(callback) {
	// house_review_count, house_id, house_name, rate_per_night, house_rating, houes_thumbnail_url
	var select_query = "select count(review.id) as num_reviews from house left join review on (house.id = review.house_id) group by house.id;";
	select_query += "select id from house; select name from house; select daily_rate as daily_rate from house; select rating_overall from house_rating; select main_image from house; select monthly_rate as monthly_rate from house";

	return db.query(select_query, callback);
}


// 8. 집 상세 화면 - get house info about currently selected house  
router.get('/house-info', function(req, res) {
	var house_id = req.query.house_id;

	// get house's full info 
	getHouseInfo(house_id, function(house_info) {
		if(house_info == -1) {
			return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
		}
		// console.log(house_info)
	// getLatestReview , getHouseAmenities , getHousePics

		async.parallel([
				function(callback) {
					getLatestReview(house_id, function(review) {
						if(house_info == -1) {
							return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
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
							return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
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
							return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
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
					return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
				}

				else {
					house_info['query_success'] = true;
					house_info['message'] = null;
					console.log(house_info)
					return res.json({query_success: true, message: null, house_info});
				}			
			}
		);
	});
});

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
			return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
		}
		context['query_success'] = true;
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
		return res.json({post_success: false, message: "err: user not logged in."});
	}
	
	// if house_id = -1, err 
	if(req.query.house_id == -1) {
		return res.json({post_success: false, message: "err: 서버가 불안정합니다."});
	}

	var house_id = req.query.house_id;
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

			// if user does, check if its status is 4 (done)
			if(reservation.status != 4) {
				return callback(new Error("user is not done staying."));
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
		review_info['review_con'] = req.query.review_content;
		review_info['rating_acr'] = req.query.rating_accuracy;
		review_info['rating_loc'] = req.query.rating_location;
		review_info['rating_com'] = req.query.rating_communication; 
		review_info['rating_chk'] = req.query.rating_checkin;
		review_info['rating_cln'] = req.query.rating_cleanliness; 
		review_info['rating_val'] = req.query.rating_value; 

		postReview(house_id, user_id, reservation_id, review_info, created, function(err, rows) {
			if(err) return callback(err);
			// successfully posted review
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
			return res.json({post_success: false , message: "err: 서버가 불안정합니다."});
		}
		return res.json({post_success: true, message: "후기가 성공적으로 등록되었습니다."});
	});
});

function checkPastReservation(house_id, user_id, callback) {
	var check_query = "select id, status from reservation where house_id = ? and user_id = ?";
	return db.query(check_query, [house_id, user_id], callback);
}

function postReview(house_id, user_id, reservation_id, review_info, created, callback) {
	var insert_visit = "insert into review (house_id, commenter_id, reservation_id, comment, rating_accuracy, rating_communication, rating_cleanliness, rating_location, rating_checkin, rating_value, created) values (?,?,?,?,?,?,?,?,?,?,?,?)";
	return db.query(insert_visit, [house_id, user_id, reservation_id, review_info.review_con, review_info.rating_acr, review_info.rating_com, review_info.rating_cln, review_info.rating_loc, review_info.rating_chk, review_info.rating_val, created], callback);
};


// TODO: add pending visits too 
// 11. 방문 목록 화면 - get user's confirmed visits 
router.get('/visit-list', function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({reservation_success: false, message: "err: user not logged in."});
	}	

	var user_id = req.user.id;

	selectConfirmedVisits(user_id, function(err, rows) {
		if(err) return res.json({query_success: false , message: "err: 서버가 불안정합니다."});

		var visits = JSON.parse(JSON.stringify(rows));
		console.log(visits)
		return res.json({query_success: true , message: null, visits});
	});
});

function selectConfirmedVisits(user_id, callback) {
	var host_query = "select visit.id as visit_id, visit.house_id, visit.user_id as visitor_id, date_time as visit_time, name as house_name, monthly_rate as rate_per_month, daily_rate as rate_per_night, rating_overall as house_rating, review_count as house_review_count, main_image as house_thumbnail_url from visit inner join house on visit.house_id = house.id inner join house_rating on house_rating.house_id = visit.house_id where visit.user_id = ? and visit.status = 1 order by visit.date_time";
	return db.query(host_query, [user_id], callback);
}

// 12. 방문 상세 화면 - get visit info about selected visit 
router.get('/visit-info', function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({reservation_success: false, message: "err: user not logged in."});
	}	

	var visit_id = req.query.visit_id;

	var context = {};

	selectVisit(visit_id, function(err, rows) {
		if(err) return res.json({query_success: false , message: "err: 서버가 불안정합니다."});

		var visit_info = JSON.parse(JSON.stringify(rows))[0];

		if(typeof visit_info === 'undefined') {
			console.log('no visit id found');
			return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
		}
		
		// console.log(visit_info);
		var house_id = visit_info['house_id'];

		getHouseInfo(house_id, function(house_info) {
			if(house_info == -1) {
				return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
			}
			// console.log(house_info)

			async.parallel([
					function(callback) {
						getLatestReview(house_id, function(review) {
							if(house_info == -1) {
								return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
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
								return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
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
								return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
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
						return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
					}

					else {
						context['query_success'] = true;
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


// TODO: for now, this is request for visit
// 13. 예약하기 (POST) - make a reservation 
router.post('/reserve-room', function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({reservation_success: false, message: "err: user not logged in."});
	}

	var user_id = req.user.id; 
	var house_id = req.query.room_id;
	var start_date = req.query.start_date; //yyyy-mm-dd
	var end_date = req.query.end_date; 
	var created = moment().format("YYYY-MM-DD HH:MM:SS");

	makeVisitRequest(house_id, user_id, start_date, end_date, created, function(err, rows) {
		if(err) {
			console.log(err)
			return res.json({reservation_success: false, message: "err: 서버가 불안정합니다."});
		} 

		// TODO: reservation으로 바꿀때 여기서 reservation_info 보내야함 

		return res.json({reservation_success: true, message: "성공적으로 예약되었습니다."});
	});
});

function makeVisitRequest(house_id, user_id, start_date, end_date, created, callback) {
	var insert_visit = "insert into visit (house_id, user_id, checkin_date, checkout_date, created) values (?,?,?,?,?)";
	return db.query(insert_visit, [house_id, user_id, start_date, end_date, created], callback);
};


//TODO
// 14. 방문 캔슬 (POST) - cancel visit request
router.post('/cancel-visit', function(req, res) {
	var visit_id = req.query.visit_id;
});


// 15. 도어락 열기 - open doorlock of currently logged in user 
router.get('/open-doorlock', function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({open_authorized: false, message: "err: user not logged in."});
	}

	// if user is not currently staying at house
	if(!req.user.staying) {
		return res.json({open_authorized: false, message: "err: user not currently staying in any house."});
	}

	// TODO: doorlock logic 
	// if door lock fails 
	// if(doorlock fails) {
		// return res.json({open_authorized: true, open_success: false, message: "실패: 도어락이 고장났습니다."})
	// }

	return res.json({open_authorized: true, open_success: true, message: null});
});


// 16. 도어락 비밀번호 변경 (POST) - change pascode for currently logged in user's house
router.post('/change-passcode', function(req, res) {
});


// 17. 비밀번호 찾기 (POST) - find user's password given user's email
router.post('/find-password', function(req, res) {
	var email = req.query.email;
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


