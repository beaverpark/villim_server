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


	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/');
	});

};
