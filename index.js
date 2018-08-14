var dust = require('dust')();
var serand = require('serand');
var utils = require('utils');
var captcha = require('captcha');

dust.loadSource(dust.compile(require('./template'), 'accounts-signin'));

module.exports = function (sandbox, options, done) {
    var home = options.location || '/';
    var signup = 'accounts://signup';
    var suffix = '';
    var append = function (suff) {
        suffix += (suffix ? '&' : '?') + suff;
    }
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
        sandbox.append(out);
        sandbox.on('click', '.accounts-signin .signin', function (e) {
            var el = $('.accounts-signin', sandbox);
            var username = $('.username', el).val();
            var password = $('.password', el).val();
            captcha.response(captchaId, function (err, captcha) {
                if (err) {
                    return console.error(err);
                }
                if (!captcha) {
                    return;
                }
                authenticate(captcha, username, password, options);
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
};

var authenticate = function (captcha, username, password, options) {
    $.ajax({
        method: 'POST',
        url: utils.resolve('accounts://apis/v/tokens'),
        data: {
            client_id: options.clientId,
            grant_type: 'password',
            username: username,
            password: password
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
