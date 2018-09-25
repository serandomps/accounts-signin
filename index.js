var dust = require('dust')();
var serand = require('serand');
var utils = require('utils');
var captcha = require('captcha');
var form = require('form');

dust.loadSource(dust.compile(require('./template'), 'accounts-signin'));


var configs = {
    username: {
        find: function (context, source, done) {
            var value = $('input', source).val();
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
            var value = $('input', source).val();
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
                lform.find(function (err, errors, data) {
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
                        lform.create(data, function (err, data) {
                            captcha.response(captchaId, function (err, captcha) {
                                if (err) {
                                    return console.error(err);
                                }
                                if (!captcha) {
                                    return;
                                }
                                authenticate(captcha, data.username, data.password, options);
                            });
                        });
                    });
                });
                return false;
            });
            sandbox.on('click', '.accounts-signin .facebook', function (e) {
                options.type = 'facebook';
                serand.emit('user', 'oauth', options);
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

var authenticate = function (captcha, username, password, options) {
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
            'X-Captcha': captcha
        },
        contentType: 'application/x-www-form-urlencoded',
        dataType: 'json',
        success: function (token) {
            var user = {
                tid: token.id,
                username: username,
                access: token.access_token,
                refresh: token.refresh_token,
                expires: token.expires_in
            };
            serand.emit('token', 'info', user.tid, user.access, function (err, token) {
                if (err) {
                    return serand.emit('user', 'login error', err);
                }
                user.has = token.has;
                serand.emit('user', 'logged in', user, options);
            });
        },
        error: function (xhr, status, err) {
            serand.emit('user', 'login error', err || status || xhr);
        }
    });
};
