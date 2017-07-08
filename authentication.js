// authentication module (login, signup, session)
module.exports = function(app, passport) {

	// GET login form
	app.get('/login', function(req, res) {
		if (req.isAuthenticated()) {
			res.redirect('/');
		}

		res.render('login', {message: req.flash('loginMessage')});
	});

	// POST process login form
	app.post('/login', passport.authenticate('local-login', 
		{
			// successRedirect : '/', // redirect to index page
			failureRedirect : '/login', // redirect back to the login page if there is an error
			failureFlash : true // allow flash messages
		}),
		function(req, res) {

			if (req.body.remember) {
			  // maxAge in ms. session continues for 200 days
			  req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 200;
			} 
			else {
			  req.session.cookie.expires = false;
			}
			res.redirect('/');
		}
	);

	// // GET login form
	// app.get('/admin', function(req, res) {
	// 	if (req.isAuthenticated() && req.user.is_admin[0]) {
	// 		res.redirect('/admin/dashboard');
	// 	}
	// 	res.render('login', {admin:"1", message: req.flash('loginMessage')});
	// });



	// GET signup form
	app.get('/signup', function(req, res) {
		if (req.isAuthenticated()) {
			res.redirect('/');
		}
		res.render('signup', { message: req.flash('signupMessage') });
	});

	// POST process the signup form
	app.post('/signup', passport.authenticate('local-signup', {
		successRedirect : '/', // redirect to index page
		failureRedirect : '/signup', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

	// GET log out 
	app.get('/logout', function(req, res) {
		if(req.user.type == 'user') {
			console.log("USER logged out");
			req.logout();
			res.redirect('/');			
		}

		else {
			console.log("ADMIN logged out");
			req.logout();
			res.redirect('/admin');			
		}
	});


	/**************************/
	/*** Andriod requests	***/
	/**************************/

	// POST andriod login
	app.post('/a/login', function(req, res, next) {
		passport.authenticate('local-login', function(err, user, info) {
			if(err) return next(err);

			if(!user) {
				return res.json({login_success: false, message:'이메일 또는 비밀번호가 올바르지 않습니다.'});
			}

			req.login(user, function(err){
				if(err){
					console.log(err)
					return next(err);
				}
          	  	req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 200;

				res.redirect('/a/userinfo');
    		});
		})(req, res, next); 
	});

	// POST andriod signup
	app.post('/a/signup', function(req, res, next) {
		passport.authenticate('local-signup', function(err, user, info) {
			if(err) return next(err);

			if(!user) {
				var signup_msg = req.body.email + ' 는 이미 사용중인 이메일입니다.';
				return res.json({signup_success: false, message: signup_msg});
			}

			req.login(user, function(err){
				if(err){
					return next(err);
				}
				req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 200;

				res.redirect('/a/userinfo');
			});
		})(req, res, next); 
	});


	// GET admin login form
	app.get('/admin/login', function(req, res) {
		// only when logged in user is admin, redirect to admin
		if (req.isAuthenticated()) {
			if(req.user.type == 'admin') {
				res.redirect('/admin');
			}
		}
		res.render('login', {message: req.flash('loginMessage'), admin: true});
	});

	// POST process admin login form
	app.post('/admin/login', passport.authenticate('local-admin-login', 
		{
			// successRedirect : '/', // redirect to index page
			failureRedirect : '/admin/login', // redirect back to the login page if there is an error
			failureFlash : true // allow flash messages
		}),
		function(req, res) {
			if (req.body.remember) {
			  // maxAge in ms. session continues for 200 days
			  req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 200;
			} 
			else {
			  req.session.cookie.expires = false;
			}
			res.redirect('/admin');
		}
	);

	// GET admin signup form
	app.get('/admin/signup', function(req, res) {
		if (req.isAuthenticated()) {
			if(req.user.type == 'admin') {
				res.redirect('/admin');
			}
		}
		res.render('signup', {message: req.flash('signupMessage'), admin: true});
	});

	// POST process the admin signup form
	app.post('/admin/signup', passport.authenticate('local-admin-signup', {
		successRedirect : '/admin', // redirect to index page
		failureRedirect : '/admin/signup', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

};