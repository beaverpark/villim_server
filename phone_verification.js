var twilio_config = require('./config/twilio');
var phoneReg = require('./lib/twilio_phone_verify')(twilio_config.API_KEY);

// phone verification module
module.exports = function(app) {

    // 핸드폰 번호 받기 / 인증코드 보내기 (POST) - get user's phone number for verification / send verification code
    app.post('/send-verification-phone', function(req, res) {
        var phone_number = req.body.phone_number;
        var country_code = 1;
        var via = "sms";
        var locale = "ko";

        if (phone_number && country_code && via) {
        phoneReg.requestPhoneVerification(phone_number, country_code, via, locale, function (err, response) {
            if (err) {
                console.log('error creating phone reg request', err);
                return res.json({success: false, message: "전화번호가 올바르지 않습니다."});
            } else {
                console.log('Success register phone API call: ', response);
                return res.json({success: true , message: null});
            }
        });
        } else {
            console.log('Failed in Register Phone API Call', req.body);
            res.status(500).json({error: "Missing fields"});
        }

    });

    // 핸드폰 인증하기 (POST) - verify user's phone by given verification code 
    app.post('/verify-phone', function(req, res) {
        var country_code = 1;
        var phone_number = req.body.phone_number;
        var token = req.body.verification_code;

        if (phone_number && country_code && token) {
        phoneReg.verifyPhoneToken(phone_number, country_code, token, function (err, response) {
            if (err) {
                console.log('error creating phone reg request', err);
                return res.json({success: false , message: "인증 실패. 인증번호를 다시 확인주세요."});
            } else {
                console.log('Confirm phone success confirming code: ', response);
                if (response.success) {
                    return res.json({success: true , message: null});
                }
                return res.json({success: false , message: "err: 서버가 불안정합니다."});
            }
        });
        } else {
            console.log('Failed in Confirm Phone request body: ', req.body);
            res.status(500).json({error: "Missing fields"});
        }
    });

};



/**
 * Register a phone
 *
 * @param req
 * @param res
 */
// exports.requestPhoneVerification = function (req, res) {
//     var phone_number = req.body.phone_number;
//     var country_code = req.body.country_code;
//     var via = req.body.via;

//     console.log("body: ", req.body);

//     if (phone_number && country_code && via) {
//         phoneReg.requestPhoneVerification(phone_number, country_code, via, function (err, response) {
//             if (err) {
//                 console.log('error creating phone reg request', err);
//                 res.status(500).json(err);
//             } else {
//                 console.log('Success register phone API call: ', response);
//                 res.status(200).json(response);
//             }
//         });
//     } else {
//         console.log('Failed in Register Phone API Call', req.body);
//         res.status(500).json({error: "Missing fields"});
//     }

// };

/**
 * Confirm a phone registration token
 *
 * @param req
 * @param res
 */
// exports.verifyPhoneToken = function (req, res) {
//     var country_code = req.body.country_code;
//     var phone_number = req.body.phone_number;
//     var token = req.body.token;
    
//     if (phone_number && country_code && token) {
//         phoneReg.verifyPhoneToken(phone_number, country_code, token, function (err, response) {
//             if (err) {
//                 console.log('error creating phone reg request', err);
//                 res.status(500).json(err);
//             } else {
//                 console.log('Confirm phone success confirming code: ', response);
//                 if (response.success) {
//                     req.session.ph_verified = true;
//                 }
//                 res.status(200).json(err);
//             }

//         });
//     } else {
//         console.log('Failed in Confirm Phone request body: ', req.body);
//         res.status(500).json({error: "Missing fields"});
//     }
// };
