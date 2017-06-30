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



// sends current session's user info 
router.get('/userinfo', function(req, res) {
	// var user_id = req.session.passport.user; 
	// if(typeof user_id === 'undefined') {
	// 	res.json({query_success: false , message: "오류 발생: 없는 아이디", user_info: null});
	// }
	
	// console.time("test");
	if (!req.isAuthenticated()) {
		return res.json({query_success: false , message: "err: user not logged in.", user_info: null});
	}

	// get user's full info 
	var user_info = getUserInfo(req, function(user_info) {
		if(user_info == -1) {
			return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
		}

		return res.json({query_success: true, message: null, user_info});
	}); 
});

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
}

// select user's hosting house ids 
function selectHostingHouses(user_id, callback) {
	var selectQuery = "select group_concat(house.id) as house_id_hosting from house where user_id = ?";
	return db.query(selectQuery, [user_id], callback);
};


// get user's current or upcoming house/reservation info 
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
	var selectQuery = "select r.id as reservation_id, r.house_id, r.checkin_date as start_date, r.checkout_date as end_date, h.main_image as house_thumbnail_url from reservation r, house h where r.house_id = h.id and r.user_id = ? and r.status = 1 order by r.checkin_date limit 1";
	return db.query(selectQuery, [user_id], callback);
};


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


// send houses info for featured houses display  
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

// get house info about given house id 
router.get('/house-info', function(req, res) {
	var house_id = req.query.house_id;

	var tasks = {};
	var house_info = {};

	// Task 1 
	// get house info by house id 
	var selectHouseById_task = function(callback) {
		selectHouseById(house_id, function(err, rows) {
			if(err) return callback(err);			

			house_info = JSON.parse(JSON.stringify(rows))[0][0];
			// house with given id doesn't exist.
			if(typeof house_info === "undefined") {
				return callback(new Error("house_id doesn't exist"));
			}
			house_rating = JSON.parse(JSON.stringify(rows))[1][0];
			house_info['house_rating'] = house_rating.rating_overall;

			house_info['house_id'] = Number(house_id); // manually add house_id

			// console.log("1")
			// console.log(house_info)

			async.parallel([
				// Task 1.1
				// get house's host info 
				function(callback) {
					selectHostById(house_info.host_id, function(err, rows) {
						if(err) return callback(err);			

						var host_info = JSON.parse(JSON.stringify(rows))[0][0];
						var host_rating = JSON.parse(JSON.stringify(rows))[1][0];
						for(var key in host_info) {
							house_info[key] = host_info[key];
						}
						house_info['host_rating'] = host_rating.rating;

						// console.log("1.1")
						// console.log(house_info)
						callback();
					});
				},
				// Task 1.2
				// get host's review count 
				function(callback) {
					selectHostReviewCount(house_info.host_id, function(err, rows) {
						if(err) return callback(err);			

						house_info['host_review_count'] = JSON.parse(JSON.stringify(rows))[0].host_review_count;
						// console.log("1.2")
						// console.log(house_info)
						callback();
					});
				},

				// Task 2
				// get house's latest review 
				function(callback) {
					selectReviewByHouseId(house_id, function(err, rows) {
						if(err) return callback(err);			

						var last_reviewer_info = JSON.parse(JSON.stringify(rows))[0];			
						for(var key in last_reviewer_info) {
							house_info[key] = last_reviewer_info[key];
						}
						// console.log("2")
						// console.log(house_info)
						callback();
					});
				},

				// Task 3
				// get house's review count 
				function(callback) {
					selectHouseReviewCount(house_id, function(err, rows) {
						if(err) return callback(err);

						house_info['house_review_count'] = JSON.parse(JSON.stringify(rows))[0].house_review_count;
						// console.log("3")
						// console.log(house_info)
						callback();
					});
				},

				// Task 4
				// get house's amenity ids  
				function(callback) {
					selectHouseAmenities(house_id, function(err, rows) {
						if(err) return callback(err);
						var amenities_info = JSON.parse(JSON.stringify(rows))[0];
						if(amenities_info.amenity_ids != null) {
							house_info['amenity_ids'] = stringToList(amenities_info.amenity_ids);
						}
						else {
							house_info['amenity_ids'] = [];
						}
						// console.log("4")
						callback();
					});
				},

				// Task 5
				// get house's pic urls 
				function(callback) {
					selectHousePics(house_id, function(err, rows) {
						if(err) return callback(err);
						var pics_info = JSON.parse(JSON.stringify(rows))[0];
						if(pics_info.house_pic_urls != null) {
							house_info['house_pic_urls'] = stringToListStr(pics_info.house_pic_urls);
						}
						else {
							house_info['house_pic_urls'] = [];
						}
						// console.log("5")
						callback();
					});
				}
			], callback);
		});
	};

	// // Task 2
	// // get the latest review info of the house
	// var selectReviewByHouseId_task = function(callback) {
	// 	selectReviewByHouseId(house_id, function(err, rows) {
	// 		if(err) return callback(err);			

	// 		var last_reviewer_info = JSON.parse(JSON.stringify(rows))[0];			
	// 		for(var key in last_reviewer_info) {
	// 			house_info[key] = last_reviewer_info[key];
	// 		}
	// 		console.log("2")
	// 		// console.log(house_info)
	// 		callback();
	// 	});
	// };

	// // Task 3
	// // get house info by house id 
	// var selectHouseReviewCount_task = function(callback) {
	// 	selectHouseReviewCount(house_id, function(err, rows) {
	// 		if(err) return callback(err);

	// 		house_info['house_review_count'] = JSON.parse(JSON.stringify(rows))[0].house_review_count;
	// 		console.log("3")
	// 		// console.log(house_info)
	// 		callback();
	// 	});
	// };

	// // Task 4
	// // get house info by house id 
	// var selectHouseAmenitiesAndPics_task = function(callback) {
	// 	selectHouseAmenitiesAndPics(house_id, function(err, rows) {
	// 		if(err) return callback(err);
	// 		var AmenitiesAndPics = JSON.parse(JSON.stringify(rows))[0];
	// 		if(AmenitiesAndPics.amenity_ids != null) {
	// 			house_info['amenity_ids'] = stringToList(AmenitiesAndPics.amenity_ids);
	// 		}
	// 		else {
	// 			house_info['amenity_ids'] = [];
	// 		}

	// 		if(AmenitiesAndPics.house_pic_urls != null) {
	// 			house_info['house_pic_urls'] = stringToListStr(AmenitiesAndPics.house_pic_urls);
	// 		}
	// 		else {
	// 			house_info['house_pic_urls'] = [];
	// 		}
	// 		console.log("4")
	// 		callback();
	// 	});
	// }

	// Adding tasks 
	tasks['task1'] = selectHouseById_task;
	// tasks['task2'] = selectReviewByHouseId_task;
	// tasks['task3'] = selectHouseReviewCount_task;
	// tasks['task4'] = selectHouseAmenitiesAndPics_task;

	// call query tasks in parallel 
	async.parallel(tasks, function(err) {
		if(err) {
			console.log(err);
			return res.json({query_success: false , message: "err: 서버가 불안정합니다."});
		}

		else {
			console.log(house_info)
			return res.json({query_success: true, message: null, house_info});
		}
	});
});

function selectHouseReviewCount(house_id, callback) {
	var selectQuery = "select count(house_id) as house_review_count from review where house_id = ?";
	return db.query(selectQuery, [house_id], callback);
}

function selectHostReviewCount(host_id, callback) {
	var selectQuery = "select count(r.id) as host_review_count from review r, house h where r.house_id = h.id and h.user_id = ?";
	return db.query(selectQuery, [host_id], callback);
}

function selectReviewByHouseId(house_id, callback) {
	var selectQuery = "select r.commenter_id as review_last_reviewer, r.comment as review_last_content, r.rating_overall as review_last_rating, u.profile_pic_url as review_last_profile_pic_url from review r, user u where (r.commenter_id = u.id) and r.house_id = ? order by r.created desc limit 1";
	return db.query(selectQuery, [house_id], callback);
}

function selectHostById(host_id, callback) {
	var selectQuery = "select concat(lastname, firstname) as host_name, profile_pic_url as host_profile_pic_url from user where id = ?;";
	selectQuery += "select rating from host where id = ?";
	return db.query(selectQuery, [host_id, host_id], callback);
}

function selectHouseById(house_id, callback) {
	var selectQuery = "select user_id as host_id, name as house_name, addr_full, addr_summary, addr_direction, description, type, num_guest, num_bedroom, num_bed, num_bathroom, format(monthly_rate,0) as rate_per_month, format(daily_rate, 0) as rate_per_night, format(utility_fee, 0) as utility_fee, format(cleaning_fee, 0) as cleaning_fee, latitude, longitude, house_policy, cancellation_policy, main_image as house_thumbnail_url from house where id = ?;";
	selectQuery += "select rating_overall from house_rating where house_id = ?";
	return db.query(selectQuery, [house_id, house_id], callback);
}

function selectHouseAmenities(house_id, callback) {
	var selectQuery = "select group_concat(amenities_id) as amenity_ids from house_amenities where house_id = ?";
	return db.query(selectQuery, [house_id], callback);
}

function selectHousePics(house_id, callback) {
	var selectQuery = "select group_concat(image) as house_pic_urls from house_images where house_id = ?";
	return db.query(selectQuery, [house_id], callback);
}



// 8. 집 후기 화면 - get all the review info about given house id
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



// 9. 호스트 화면 - get host info by given user id
router.get('/host-info', function(req, res) {
	var host_id = req.query.host_id;

	selectHostById2(host_id, function(err, rows) {
		if(err) return res.json({query_success: false , message: "err: 서버가 불안정합니다."});

		var host_info = JSON.parse(JSON.stringify(rows))[0];

		if(typeof host_info === 'undefined') {
			return res.json({query_success: false , message: "host_id doens't exist."});
		}
		host_info['host_id'] = Number(host_id); // manually add host_id
		host_info['query_success'] = true;
		host_info['message'] = null;
		console.log(host_info)
		return res.json(host_info);
	});

});

function selectHostById2(host_id, callback) {
	var host_query = "select concat(lastname, firstname) as host_name, about, profile_pic_url as host_picture_url from user where id = ?";
	return db.query(host_query, [host_id], callback);
}

// TODO: for now, this is request for visit
// 10. 예약하기(POST) - make a reservation 
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

// 11. 방문 리스트 화면 - get user's confirmed visits 
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

// 12. 방문 상세 화면 - get detailed visit info by visit id 
router.get('/visit-info', function(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({reservation_success: false, message: "err: user not logged in."});
	}	

	var visit_id = req.query.visit_id;




});

// 13. 방문 캔슬 
router.get('/cancel-visit', function(req, res) {
	var visit_id = req.query.visitId;	// TODO: typo?
});

// 14. 리뷰 남기기(POST) - post a review to given house id 
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


// 15. 프로필 변경하기(POST) - update uesr's profile 
router.post('/update-profile', function(req, res) {
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

		// redirect to getting user's changed full info 
		res.redirect('/a/userinfo');
	});

});

function updateProfile(user_id, new_profile, callback) {
	var update_user = "update user set firstname = ?, lastname = ?, sex = ?, about = ?, city_of_residence = ? where id = ?";
	return db.query(update_user, [new_profile.firstname, new_profile.lastname, new_profile.sex, new_profile.about, new_profile.city_of_residence, user_id], callback);
};


// 16. 비밀번호 찾기 (POST) - find user's password given user's email
router.post('/find-password', function(req, res) {
	var email = req.query.email;
});


// TODO: no house id given????
// 17. 도어락 비밀번호 변경 (POST) - change pascode for doorlock of given house
router.post('/change-passcode', function(req, res) {
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


/************************/
/*** QUERY functions ****/
/************************/
function selectAllHouses(callback) {
	// house_review_count, house_id, house_name, rate_per_night, house_rating, houes_thumbnail_url
	var select_query = "select count(review.id) as num_reviews from house left join review on (house.id = review.house_id) group by house.id;";
	select_query += "select id from house; select name from house; select format(daily_rate, 0) as daily_rate from house; select rating_overall from house_rating; select main_image from house; select format(monthly_rate, 0) as monthly_rate from house";

	return db.query(select_query, callback);
}

