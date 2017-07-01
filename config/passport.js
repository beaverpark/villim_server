// passport configurations
var localStrategy = require('passport-local').Strategy; 
var bcrypt = require('bcrypt-nodejs');
var moment = require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");



module.exports = function(passport, connection) {
    /*
  		Passport session setup
		- required for persistent login sessions
	*/

	// serialize user for the session
	passport.serializeUser(function(user, done)  {
		done(null, user.id);
	});

    // deserialize the user
    passport.deserializeUser(function(id, done) {
        connection.query("SELECT * FROM user WHERE id = ? ",[id], function(err, rows){
            done(err, rows[0]);
        });
    });

	// Local strategies: SIGNUP  
	passport.use(
		'local-signup', 
		new localStrategy({
			usernameField: 'email',	// overwrite default username with email 
			passwordField: 'password',
			passReqToCallback: true	// passes back req to the callback 
		},
		function(req, username, password, done) {
            var created_at = moment().format("YYYY-MM-DD HH:MM:SS"); 

			//  check if the user trying to sign up already exists
			connection.query("SELECT * FROM user WHERE email = ?", [username], function(err, rows) {
                if (err)
                    return done(err);
                // if there is a matching email, show error msg
                if (rows.length) {
                    return done(null, false, req.flash('signupMessage', username + ' 는 이미 사용중인 이메일입니다.'));
                } 
                // if there is no user with given email, create user
                else {
                    var newUser = {
                        email: username,
                        firstname: req.body.firstname,
                        lastname: req.body.lastname,
                        password: bcrypt.hashSync(password, null, null)  // use the generateHash function in our user model
                    };

                    var insertQuery = "INSERT INTO user ( email, password, firstname, lastname, created) values (?,?,?,?,?)";

                    connection.query(insertQuery,[newUser.email, newUser.password, newUser.firstname, newUser.lastname, created_at],function(err, rows) {
                        newUser.id = rows.insertId;
                        console.log("user created");
                        return done(null, newUser);
                    });
                }
            });
		})
	);
	
	// Local strategies: LOGIN 
	passport.use(
		'local-login', 
		new localStrategy({
			usernameField: 'email',	// overwrite default username with email 
			passwordField: 'password',
			passReqToCallback: true	// passes back req to the callback 
		},
		// callback with email and password from the form 
		function(req, username, password, done) {
			//  check if the user trying to sign up already exists
			connection.query("SELECT * FROM user WHERE email = ?", [username], function(err, rows) {
                if (err)
                    return done(err);
                // if there is no matching email, show error msg
                if (!rows.length) {
                    return done(null, false, req.flash('loginMessage', '빌림에 등록되지 않은 이메일입니다.'));
                } 
                // if the user is found, but the password is wrong, show error msg
                if(!bcrypt.compareSync(password, rows[0].password)) {
                    return done(null, false, req.flash('loginMessage', '비밀번호가 올바르지 않습니다.'));
                }
                console.log("user logged in");
                return done(null, rows[0]);
            });
		})
	);
};