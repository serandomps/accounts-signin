var dust = require('dust')();
var serand = require('serand');
var utils = require('utils');

var clientId;

var active;

var pending;

dust.loadSource(dust.compile(require('./template'), 'accounts-signin'));

module.exports = function (sandbox, fn, options) {
    dust.render('accounts-signin', {}, function (err, out) {
        if (err) {
            return;
        }
        sandbox.append(out);
        sandbox.on('click', '.accounts-signin .signin', function (e) {
            var el = $('.accounts-signin', sandbox);
            var username = $('.username', el).val();
            var password = $('.password', el).val();
            if (!clientId) {
                pending = {
                    username: username,
                    password: password,
                    options: options
                };
                return;
            }
            authenticate(username, password, options);
            return false;
        });
        fn(false, function () {
            $('.accounts-signin', sandbox).remove();
        });
    });
};

utils.boot(function (err, config) {
    clientId = config.clientId;
    if (!pending) {
        return;
    }
    authenticate(pending.username, pending.password, pending.options);
    pending = null;
});

var authenticate = function (username, password, options) {
    var passive = !!options.clientId;
    $.ajax({
        method: 'POST',
        url: '/apis/v/tokens',
        headers: {
            'x-host': 'accounts.serandives.com'
        },
        data: {
            client_id: passive ? options.clientId : clientId,
            grant_type: 'password',
            username: username,
            password: password
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
            permissions(user, options);
        },
        error: function () {
            serand.emit('user', 'login error');
        }
    });
};

var permissions = function (user, options) {
    $.ajax({
        method: 'GET',
        url: '/apis/v/tokens/' + user.tid,
        headers: {
            'x-host': 'accounts.serandives.com',
            'Authorization': 'Bearer ' + user.access
        },
        dataType: 'json',
        success: function (token) {
            user.has = token.has;
            serand.emit('user', 'logged in', user, options);
        },
        error: function () {
            serand.emit('user', 'login error');
        }
    });
};

serand.on('user', 'authenticate', function (username, password) {
    if (clientId) {
        return authenticate(username, password);
    }
    active = {
        username: username,
        password: password
    };
});
