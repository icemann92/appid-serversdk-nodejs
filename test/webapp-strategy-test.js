/*
 Copyright 2017 IBM Corp.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

const chai = require("chai");
const assert = chai.assert;
const proxyquire = require("proxyquire");
const osLocale = require("os-locale");
const defaultLocale = osLocale.sync();
var previousAccessToken = "test.previousAccessToken.test";

describe("/lib/strategies/webapp-strategy", function(){
	console.log("Loading webapp-strategy-test.js");

	var WebAppStrategy;
	var webAppStrategy;
	
	before(function(){
		WebAppStrategy = proxyquire("../lib/strategies/webapp-strategy", {
			"./../utils/token-util": require("./mocks/token-util-mock"),
			"request": requestMock
		});
		webAppStrategy = new WebAppStrategy({
			tenantId: "tenantId",
			clientId: "clientId",
			secret: "secret",
			oauthServerUrl: "https://oauthServerUrlMock",
			redirectUri: "https://redirectUri"
		});
	});

	describe("#properties", function(){
		it("Should have all properties", function(){
			assert.isFunction(WebAppStrategy);
			assert.equal(WebAppStrategy.STRATEGY_NAME, "appid-webapp-strategy");
			assert.equal(WebAppStrategy.DEFAULT_SCOPE, "appid_default");
			assert.equal(WebAppStrategy.ORIGINAL_URL, "APPID_ORIGINAL_URL");
			assert.equal(WebAppStrategy.AUTH_CONTEXT, "APPID_AUTH_CONTEXT");
		});
	});

	describe("#logout", function(){
		it("Should be able to successfully logout", function(done){
			var req = {
				logout: function(){
					assert.isUndefined(this[WebAppStrategy.ORIGINAL_URL]);
					assert.isUndefined(this[WebAppStrategy.AUTH_CONTEXT]);
					done();
				},
				session: {
					APPID_ORIGINAL_URL: "url",
					APPID_AUTH_CONTEXT: "context"
				}
			};
			WebAppStrategy.logout(req);
		});
	});


	describe("#authenticate()", function(){
		it("Should fail if request doesn't have session", function(done){
			webAppStrategy.error = function(err){
				assert.equal(err.message, "Can't find req.session");
				done();
			};

			webAppStrategy.authenticate({});
		});

		it("Should be able to detect unauthenticated request and redirect to authorization", function(done){
			var req = {
				isAuthenticated: function(){
					return false;
				},
				url: "originalUrl",
				session: {}
			};

			webAppStrategy.redirect = function (url) {
				assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&language=" + defaultLocale);
				assert.equal(req.session[WebAppStrategy.ORIGINAL_URL], "originalUrl");
				done();
			};

			webAppStrategy.authenticate(req, {});
		});

		it("Should be able to detect authenticated request and skip strategy", function(done){
			var req = {
				isAuthenticated: function(){
					return true;
				},
				session: {}
			};

			webAppStrategy.pass = function(){
				done();
			}

			webAppStrategy.authenticate(req, {});
		});


		it("Should fail if error was returned in callback", function(done){
			webAppStrategy.fail = function(){
				done();
			};

			webAppStrategy.authenticate({
				session: {},
				query: {
					error: "test error"
				}
			});
		});

		describe("handle RoP flow", function () {
			it("Should handle RoP flow successfully", function(done){
				webAppStrategy.fail = function(err){
					done(err);
				};
				webAppStrategy.success = function(user){
					assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT]);
					assert.isString(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken, "access_token_mock");
					assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload.scope, "appid_default");
					assert.isString(req.session[WebAppStrategy.AUTH_CONTEXT].identityToken);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].identityToken, "id_token_mock");
					assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload.scope, "appid_default");
					assert.isObject(user);
					assert.equal(user.scope, "appid_default");
					done();
				};
				var req = {
					session: {},
					method: "POST",
					body: {
						username: "test_username",
						password: "good_password"
					}
				};
				webAppStrategy.authenticate(req);
			});
			
			it("Should handle RoP flow successfully with previous access token", function(done){
				webAppStrategy.fail = function(err){
					done(err);
				};
				webAppStrategy.success = function(user){
					assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT]);
					assert.isString(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken, "access_token_mock");
					assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload.scope, "appid_default");
					assert.isString(req.session[WebAppStrategy.AUTH_CONTEXT].identityToken);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].identityToken, "id_token_mock");
					assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload.scope, "appid_default");
					assert.isObject(user);
					assert.equal(user.scope, "appid_default");
					done();
				};
				var session = {};
				var accessTokenPayload = {
					amr: ["appid_anon"]
				};
				var accessToken = previousAccessToken;
				var appIdAuthContext = {
					accessToken: accessToken,
					accessTokenPayload: accessTokenPayload
				};
				session[WebAppStrategy.AUTH_CONTEXT] = appIdAuthContext;
				var req = {
					session: session,
					method: "POST",
					body: {
						username: "test_username",
						password: "good_password"
					}
				};
				webAppStrategy.authenticate(req);
			});
			
			it("Should handle RoP flow successfully - check options", function(done){
				webAppStrategy.fail = function(err){
					done(err);
				};
				webAppStrategy.success = function(user) {
					assert.equal(options.successRedirect, "test_success_url");
					assert.equal(options.failureRedirect, "test_failure_url");
					assert.equal(options.failureFlash, true);
					assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT]);
					assert.isString(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken, "access_token_mock_test_scope");
					assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload.scope, "test_scope");
					assert.isString(req.session[WebAppStrategy.AUTH_CONTEXT].identityToken);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].identityToken, "id_token_mock_test_scope");
					assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload.scope, "test_scope");
					assert.isObject(user);
					assert.equal(user.scope, "test_scope");
					done();
				};
				var req = {
					session: {},
					method: "POST",
					body: {
						username: "test_username",
						password: "good_password"
					}
				};
				var options = {
					scope: "test_scope",
					successRedirect: "test_success_url",
					failureRedirect: "test_failure_url",
					failureFlash : true
				};
				webAppStrategy.authenticate(req, options);
			});
			
			it("Should handle RoP flow failure - bad credentials", function(done){
				webAppStrategy.fail = function(err){
					assert.equal(err.message, "wrong credentials");
					done();
				};
				var req = {
					session: {},
					method: "POST",
					body: {
						username: "test_username",
						password: "bad_password"
					}
				};
				webAppStrategy.authenticate(req);
			});
			
			it("Should handle RoP flow - request failure", function(done){
				webAppStrategy.fail = function(err){
					assert.equal(err.message, "REQUEST_ERROR");
					done();
				};
				var req = {
					session: {},
					method: "POST",
					body: {
						username: "request_error",
						password: "good_password"
					}
				};
				webAppStrategy.authenticate(req);
			});
			
			it("Should handle RoP flow - JSON parse failure", function(done){
				webAppStrategy.fail = function(err){
					assert.equal(err.message, "Failed to obtain tokens");
					done();
				};
				var req = {
					session: {},
					method: "POST",
					body: {
						username: "parse_error",
						password: "good_password"
					}
				};
				webAppStrategy.authenticate(req);
			});


			it("Happy SIGN_UP flow - check req.session.originalUrl = successRedirect", function (done) {
				var req = {
					session: {},
					isAuthenticated: function(){ return false; },
					isUnauthenticated: function(){ return true; }
				};

				webAppStrategy.redirect = function(url){
					assert.equal(req.session[WebAppStrategy.ORIGINAL_URL], "success-redirect");
					assert.include(url, "response_type=sign_up");
					done();
				};

				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.SIGN_UP,
					successRedirect: "success-redirect"
				});

			});
		});
		
		it("Should handle callback if request contains grant code. Fail due to tokenEndpoint error", function(done){
			webAppStrategy.fail = function(err){
				assert.equal(err.message, "STUBBED_ERROR");
				done();
			};
			var req = {
				session: {},
				query: {
					code: "FAILING_CODE"
				}
			};
			webAppStrategy.authenticate(req);
		});

		it("Should handle callback if request contains grant code. Success with options.successRedirect", function(done){
			webAppStrategy.success = function(user){

				assert.equal(options.successRedirect, "redirectUri");
				assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT]);

				assert.isString(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken);
				assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken, "access_token_mock");
				assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload);
				assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload.scope, "appid_default");

				assert.isString(req.session[WebAppStrategy.AUTH_CONTEXT].identityToken);
				assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].identityToken, "id_token_mock");
				assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload);
				assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload.scope, "appid_default");

				assert.isObject(user);
				assert.equal(user.scope, "appid_default");

				done();
			};

			var req = {
				session: {},
				query: {
					code: "WORKING_CODE"
				}
			};

			var options = {
				successRedirect: "redirectUri"
			};

			webAppStrategy.authenticate(req, options);
		});

		it("Should handle callback if request contains grant code. Success with WebAppStrategy.ORIGINAL_URL", function(done){
			webAppStrategy.success = function(){
				assert.equal(options.successRedirect, "originalUri");
				done();
			};

			var req = {
				session: {
					APPID_ORIGINAL_URL: "originalUri"
				},
				query: {
					code: "WORKING_CODE"
				}
			};

			var options = {};

			webAppStrategy.authenticate(req, options);
		});

		it("Should be able to login with null identity token", function(done){
			webAppStrategy.success = function(){
				assert.equal(options.successRedirect, "originalUri");
				done();
			};

			var req = {
				session: {
					APPID_ORIGINAL_URL: "originalUri"
				},
				query: {
					code: "NULL_ID_TOKEN"
				}
			};

			var options = {};

			webAppStrategy.authenticate(req, options);
		});

		it("Should handle callback if request contains grant code. Success with redirect to /", function(done){
			webAppStrategy.success = function(){
				assert.equal(options.successRedirect, "/");
				done();
			};

			var req = {
				session: {
				},
				query: {
					code: "WORKING_CODE"
				}
			};

			var options = {};

			webAppStrategy.authenticate(req, options);
		});

		it("Should handle callback if request contains grant code. Success with redirect to successRedirect", function(done){
			webAppStrategy.redirect = function(url){
				assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&language=" + defaultLocale);
				assert.equal(req.session[WebAppStrategy.ORIGINAL_URL], "success-callback");
				done();
			};

			var req = {
				session: {},
				isAuthenticated: function(){
					return false;
				}
			};

			var options = {
				successRedirect: "success-callback"
			};

			webAppStrategy.authenticate(req, options);
		});


		it("Should handle authorization redirect to App ID /authorization endpoint with default scope", function(done){
			webAppStrategy.redirect = function(url){
				assert.equal(url, encodeURI("https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&language=" + defaultLocale));
				done();
			}
			webAppStrategy.authenticate({
				session: {},
				isAuthenticated: function(){ return false; }
			});
		});

		it("Should handle authorization redirect to App ID /authorization endpoint with custom scope", function(done){
			webAppStrategy.redirect = function(url){
				assert.equal(url, encodeURI("https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default customScope&language=" + defaultLocale));
				done();
			};
			webAppStrategy.authenticate({
				session: {},
				isAuthenticated: function(){ return false; }
			}, {
				scope: "customScope"
			});
		});

		it("Should inject anonymous access token into request url if one is present", function(done){
			var req = {
				session: {},
				isAuthenticated: function(){ return false; }
			};
			req.session[WebAppStrategy.AUTH_CONTEXT] =  {
				accessTokenPayload: {
					amr: ["appid_anon"]
				},
				accessToken: "test_access_token"
			};
			webAppStrategy.redirect = function(url){
				assert.include(url, "appid_access_token=test_access_token");
				done();
			};

			webAppStrategy.authenticate(req);
		});

		it("Should fail if previous anonymous access token is not found and anon user is not allowed", function(done){
			var req = {
				session: {},
				isAuthenticated: function(){ return false; }
			};

			webAppStrategy.fail = function(){
				done();
			};

			webAppStrategy.authenticate(req, {
				allowAnonymousLogin: true,
				allowCreateNewAnonymousUser: false
			});
		});

		it("Should be able to login anonymously", function(done) {
			var req = {
				session: {},
				isAuthenticated: function(){ return false; }
			};

			webAppStrategy.redirect = function(url){
				assert.include(url, "idp=appid_anon");
				done();
			};

			webAppStrategy.authenticate(req, {
				allowAnonymousLogin: true,
				allowCreateNewAnonymousUser: true
			});
		});
		
		it("Should show sign up screen", function(done) {
			var req = {
				session: {},
				isAuthenticated: function(){ return false; }
			};
			
			webAppStrategy.redirect = function(url){
				assert.include(url, "response_type=sign_up");
				done();
			};
			
			webAppStrategy.authenticate(req, {
				show: WebAppStrategy.SIGN_UP
			});
		});
		
		describe ("change password tests", function () {
			it("user not authenticated", function(done) {
				var req = {
					session: {},
					isAuthenticated: function(){ return false; },
					isUnauthenticated: function(){ return true; }
				};
				
				webAppStrategy.fail = function(error) {
					try{
						assert.equal(error.message, "No identity token found.");
						done();
					}catch (e) {
						done(e);
					}
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_PASSWORD
				});
			});
			it("user authenticated but not with cloud directory", function(done) {
				var req = {
					session: {APPID_AUTH_CONTEXT: {identityTokenPayload: {amr: ["not_cloud_directory"]}}},
					isAuthenticated: function(){ return true; },
					isUnauthenticated: function(){ return false; }
				};
				
				webAppStrategy.fail = function(error) {
					try{
						assert.equal(error.message, "The identity token was not retrieved using cloud directory idp.");
						done();
					}catch (e) {
						done(e);
					}
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_PASSWORD
				});
			});
			it("happy flow - user authenticated with cloud directory", function(done) {
				var req = {
					session: {APPID_AUTH_CONTEXT: {
						identityTokenPayload: {
							amr: ["cloud_directory"],
							identities: [{id: "testUserId"}]
						}
					 }
					},
					isAuthenticated: function(){ return true; },
					isUnauthenticated: function(){ return false; }
				};
				
				webAppStrategy.redirect = function(url){
					assert.include(url, "/cloud_directory/change_password?client_id=clientId&redirect_uri=https://redirectUri&user_id=testUserId");
					done();
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_PASSWORD
				});
			});
		});
		
		describe ("change details tests", function () {
			it("user not authenticated", function(done) {
				var req = {
					session: {},
					isAuthenticated: function(){ return false; },
					isUnauthenticated: function(){ return true; }
				};
				
				webAppStrategy.fail = function(error) {
					try{
						assert.equal(error.message, "No identity token found.");
						done();
					}catch (e) {
						done(e);
					}
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_DETAILS
				});
			});
			it("user authenticated but not with cloud directory", function(done) {
				var req = {
					session: {APPID_AUTH_CONTEXT: {identityTokenPayload: {amr: ["not_cloud_directory"]}}},
					isAuthenticated: function(){ return true; },
					isUnauthenticated: function(){ return false; }
				};
				
				webAppStrategy.fail = function(error) {
					try{
						assert.equal(error.message, "The identity token was not retrieved using cloud directory idp.");
						done();
					}catch (e) {
						done(e);
					}
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_DETAILS
				});
			});
			it("happy flow - user authenticated with cloud directory", function(done) {
				var req = {
					session: {APPID_AUTH_CONTEXT: {
						identityTokenPayload: {
							amr: ["cloud_directory"],
							identities: [{id: "testUserId"}]
						}
					}
					},
					isAuthenticated: function(){ return true; },
					isUnauthenticated: function(){ return false; }
				};
				
				webAppStrategy.redirect = function(url){
					assert.include(url, "/cloud_directory/change_details?client_id=clientId&redirect_uri=https://redirectUri&code=1234");
					done();
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_DETAILS
				});
			});
			it("Bad flow - error on generate code request", function(done) {
				var req = {
					session: {APPID_AUTH_CONTEXT: {
						identityToken: 'error',
						identityTokenPayload: {
							amr: ["cloud_directory"],
							identities: [{id: "testUserId"}]
						}
					}
					},
					isAuthenticated: function(){ return true; },
					isUnauthenticated: function(){ return false; }
				};
				
				webAppStrategy.fail = function(error){
					assert.include(error.message, "STUBBED_ERROR");
					done();
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_DETAILS
				});
			});
			it("Bad flow - not 200 response on generate code request", function(done) {
				var req = {
					session: {APPID_AUTH_CONTEXT: {
						identityToken: 'statusNot200',
						identityTokenPayload: {
							amr: ["cloud_directory"],
							identities: [{id: "testUserId"}]
						}
					}
					},
					isAuthenticated: function(){ return true; },
					isUnauthenticated: function(){ return false; }
				};
				
				webAppStrategy.fail = function(error){
					assert.include(error.message, "generate code: response status code:400");
					done();
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_DETAILS
				});
			});
		});
		
		describe("forgot password tests", function () {
			it("Happy flow", function (done) {
				var req = {
					session: {APPID_AUTH_CONTEXT: {
						identityTokenPayload: {
							amr: ["cloud_directory"],
							identities: [{id: "testUserId"}]
						}
					}
					},
					isAuthenticated: function(){ return true; },
					isUnauthenticated: function(){ return false; }
				};

				webAppStrategy.redirect = function(url){
					assert.include(url, "/cloud_directory/forgot_password?client_id=clientId");
					done();
				};

				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.FORGOT_PASSWORD
				});

			});

			it("Happy FORGOT_PASSWORD flow - check req.session.originalUrl = successRedirect", function (done) {
				var req = {
					session: {APPID_AUTH_CONTEXT: {
						identityTokenPayload: {
							amr: ["cloud_directory"],
							identities: [{id: "testUserId"}]
						}
					}
					},
					isAuthenticated: function(){ return true; },
					isUnauthenticated: function(){ return false; }
				};

				webAppStrategy.redirect = function(url){
					assert.equal(req.session[WebAppStrategy.ORIGINAL_URL], "success-redirect");
					assert.include(url, "/cloud_directory/forgot_password?client_id=clientId");
					done();
				};

				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.FORGOT_PASSWORD,
					successRedirect: "success-redirect"
				});

			});
		});

		describe ("Preferred locale tests", function(){
			const french = "fr";
			var req;

			beforeEach(function() {
				req = {
					isAuthenticated: function(){
						return false;
					},
					session: {}
				};
			});

			var checkDefaultLocale = function (done) {
				return function(url) {
					assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&language=" + defaultLocale);
					assert.isUndefined(req.session[WebAppStrategy.LANGUAGE]);
					done();
				}
			};

			var checkCustomLocaleFromSession = function (done) {
				return function(url) {
					assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&language=" + french);
					assert.equal(req.session[WebAppStrategy.LANGUAGE], french);
					done();
				}
			};

			var checkCustomLocaleFromInit = function (done) {
				return function(url) {
					assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&language=" + french);
					assert.isUndefined(req.session[WebAppStrategy.LANGUAGE]);
					assert.equal(webAppStrategy.serviceConfig.getPreferredLocale(), french);
					done();
				}
			};

			it("Should redirect to authorization with os locale, overwrite it to 'fr' with setPreferredLocale and expect Should redirect to authorization with 'fr' custom locale", function(done) {

				//1. redirect to authorization with os locale
				webAppStrategy.redirect = checkDefaultLocale(done);
				webAppStrategy.authenticate(req, {});

				//2. overwrite it to 'fr' with setPreferredLocale
				webAppStrategy.setPreferredLocale(req, french);
				webAppStrategy.redirect = checkCustomLocaleFromSession(done);
				webAppStrategy.authenticate(req, {});
			});

			it("Should redirect to authorization with custom preferred locale from session", function(done) {

				webAppStrategy.setPreferredLocale(req, french);
				webAppStrategy.redirect = checkCustomLocaleFromSession(done);
				webAppStrategy.authenticate(req, {});
			});

			it("Should redirect to authorization with custom preferred locale from init", function(done) {

				webAppStrategy = new WebAppStrategy({
					tenantId: "tenantId",
					clientId: "clientId",
					secret: "secret",
					oauthServerUrl: "https://oauthServerUrlMock",
					redirectUri: "https://redirectUri",
					preferredLocale: french
				});

				webAppStrategy.redirect = checkCustomLocaleFromInit(done);
				webAppStrategy.authenticate(req, {});
			});
		});
	});
});


var requestMock = function (options, callback) {
	if (options.url.indexOf("generate_code") >= 0) {
		if (options.auth.bearer.indexOf("error") >= 0) {
			return callback(new Error("STUBBED_ERROR"), {statusCode: 0}, null);
		}
		if (options.auth.bearer.indexOf("statusNot200") >= 0) {
			return callback(null, {statusCode: 400}, null);
		}
		return callback(null, {statusCode: 200}, "1234");
	}
	if (options.url.indexOf("FAIL-PUBLIC-KEY") >= 0 || options.url.indexOf("FAIL_REQUEST") >= 0) { // Used in public-key-util-test
		return callback(new Error("STUBBED_ERROR"), {statusCode: 0}, null);
	} else if (options.url.indexOf("SUCCESS-PUBLIC-KEY") !== -1) { // Used in public-key-util-test
		return callback(null, {statusCode: 200}, {"n": 1, "e": 2});
	} else if (options.formData && options.formData.code && options.formData.code.indexOf("FAILING_CODE") !== -1) { // Used in webapp-strategy-test
		return callback(new Error("STUBBED_ERROR"), {statusCode: 0}, null);
	} else if (options.formData && options.formData.code && options.formData.code.indexOf("WORKING_CODE") !== -1) { // Used in webapp-strategy-test
		return callback(null, {statusCode: 200}, JSON.stringify({
			"access_token": "access_token_mock",
			"id_token": "id_token_mock"
		}));
	} else if (options.followRedirect === false) {
		return callback(null, {
			statusCode: 302,
			headers: {
				location: "test-location?code=WORKING_CODE"
			}
		});
	} else if (options.formData && options.formData.code && options.formData.code.indexOf("NULL_ID_TOKEN") !== -1) {
		return callback(null, {statusCode: 200}, JSON.stringify({
			"access_token": "access_token_mock",
			"id_token": "null_scope"
		}));
	} else if (options.formData.username === "test_username" && options.formData.password === "bad_password") {
		return callback(null, {statusCode: 401}, JSON.stringify({error:"invalid_grant", error_description:"wrong credentials"}));
	}else if (options.formData.username === "request_error") {
		return callback(new Error("REQUEST_ERROR"), {statusCode: 0}, null);
	}else if (options.formData.username === "parse_error") {
		return callback(null, {statusCode: 401}, JSON.stringify({error:"invalid_grant", error_description:"wrong credentials"})+"dddddd");
	} else if (options.formData.username === "test_username" && options.formData.password === "good_password") {
		if (options.formData.scope) {
			return callback(null, {statusCode: 200}, JSON.stringify({
				"access_token": "access_token_mock_test_scope",
				"id_token": "id_token_mock_test_scope"
			}));
		}
		if (options.formData.appid_access_token) {
			if (options.formData.appid_access_token === previousAccessToken) {
				return callback(null, {statusCode: 200}, JSON.stringify({
					"access_token": "access_token_mock",
					"id_token": "id_token_mock",
					"previousAccessToken": previousAccessToken
				}));
			}
			return callback(null, {statusCode: 400}, {});
		}
		return callback(null, {statusCode: 200}, JSON.stringify({
			"access_token": "access_token_mock",
			"id_token": "id_token_mock"
		}));
  } else {
		throw "Unhandled case!!!" + JSON.stringify(options);
	}
};
