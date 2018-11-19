var dust = require('dust')();
var serand = require('serand');
var utils = require('utils');
var captcha = require('captcha');
var form = require('form');
var auth = require('auth');
var token = require('token');
var redirect = serand.redirect;

dust.loadSource(dust.compile(require('./template'), 'accounts-signin'));

var configs = {
    username: {
        find: function (context, source, done) {
            done(null, $('input', source).val());
        },
        validate: function (context, data, value, done) {
            if (!value) {
                return done(null, 'Please enter your username');
            }
            if (!is.email(value)) {
                return done(null, 'Please enter a valid email address');
            }
            done(null, null, value);
        },
        update: function (context, source, error, value, done) {
            $('input', source).val(value);
            done()
        }
    },
    password: {
        find: function (context, source, done) {
            done(null, $('input', source).val());
        },
        validate: function (context, data, value, done) {
            if (!value) {
                return done(null, 'Please enter your password');
            }
            done(null, null, value);
        },
        update: function (context, source, error, value, done) {
            $('input', source).val(value);
            done();
        }
    },
};

module.exports = function (ctx, sandbox, options, done) {
    var home = options.location || '/';
    var signup = 'accounts:///signup';
    var suffix = '';
    var append = function (suff) {
        suffix += (suffix ? '&' : '?') + suff;
    };
    if (options.clientId) {
        append('client_id=' + options.clientId);
    }
    if (options.location) {
        append('redirect_uri=' + options.location);
    }
    signup += suffix;
    signup = utils.resolve(signup);

    var captchaId;

    dust.render('accounts-signin', {home: home, signup: signup}, function (err, out) {
        if (err) {
            return done(err);
        }
        var elem = sandbox.append(out);
        var lform = form.create(elem, configs);
        lform.render(ctx, {}, function (err) {
            if (err) {
                return done(err);
            }
            var signin = $('.accounts-signin .signin', elem);
            sandbox.on('click', '.accounts-signin .signin', function (e) {
                lform.find(function (err, data) {
                    if (err) {
                        return console.error(err);
                    }
                    lform.validate(data, function (err, errors, data) {
                        if (err) {
                            return console.error(err);
                        }
                        if (errors) {
                            lform.update(errors, data, function (err) {
                                if (err) {
                                    return console.error(err);
                                }
                                signin.removeAttr('disabled');
                            });
                            return;
                        }
                        lform.update(errors, data, function (err) {
                            if (err) {
                                return console.error(err);
                            }
                            lform.create(data, function (err, errors, data) {
                                if (err) {
                                    return console.error(err);
                                }
                                if (errors) {
                                    lform.update(errors, data, function (err) {
                                        if (err) {
                                            return console.error(err);
                                        }
                                        signin.removeAttr('disabled');
                                    });
                                    return;
                                }
                                captcha.response(captchaId, function (err, xcaptcha) {
                                    if (err) {
                                        return console.error(err);
                                    }
                                    if (!xcaptcha) {
                                        return;
                                    }
                                    authenticate(captcha, captchaId, xcaptcha, data.username, data.password, options, function (err) {
                                        if (err) {
                                            return console.error(err);
                                        }
                                    });
                                });
                            });
                        });
                    });
                });
                return false;
            });
            sandbox.on('click', '.accounts-signin .facebook', function (e) {
                serand.store('oauth', {
                    type: 'facebook',
                    clientId: options.clientId,
                    location: options.location
                });
                auth.authenticator({
                    type: 'facebook',
                    location: utils.resolve('accounts:///auth/oauth')
                }, function (err, uri) {
                    redirect(uri);
                });
                return false;
            });
            done(null, {
                clean: function () {
                    $('.accounts-signin', sandbox).remove();
                },
                ready: function () {
                    captcha.render($('.captcha', sandbox), {
                        success: function () {
                            $('.accounts-signin .signin', sandbox).removeAttr('disabled');
                        }
                    }, function (err, id) {
                        if (err) {
                            return console.error(err);
                        }
                        captchaId = id;
                    });
                }
            });
        });
    });
};

var authenticate = function (captcha, captchaId, xcaptcha, username, password, options, done) {
    $.ajax({
        method: 'POST',
        url: utils.resolve('accounts:///apis/v/tokens'),
        data: {
            client_id: options.clientId,
            redirect_uri: options.location,
            grant_type: 'password',
            username: username,
            password: password,
        },
        headers: {
            'X-Captcha': xcaptcha
        },
        contentType: 'application/x-www-form-urlencoded',
        dataType: 'json',
        success: function (tok) {
            var user = {
                tid: tok.id,
                username: username,
                access: tok.access_token,
                refresh: tok.refresh_token,
                expires: tok.expires_in
            };
            token.findOne(user.tid, user.access, function (err, tok) {
                if (err) {
                    serand.emit('user', 'login error', err);
                    return done(err);
                }
                user.has = tok.has;
                serand.emit('user', 'logged in', user, options);
                done()
            });
        },
        error: function (xhr, status, err) {
            captcha.reset(captchaId, function () {
                err = err || status || xhr;
                serand.emit('user', 'login error', err);
                done(err);
            });
        }
    });
};
