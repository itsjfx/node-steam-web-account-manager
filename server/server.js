const Express = require('express');
const SteamTotp = require('steam-totp');
const fs = require('fs');

const server = new Express();

// Set up the web server
fs.readFile(__dirname + '/config.json', function(err, file) {
	if (err) {
		console.log("Fatal error reading config.json: " + err.message);
		process.exit(1);
	}

	const config = JSON.parse(file.toString('utf8'));

	// Everything looks good so far.
	server.listen(config.port, config.ip || "0.0.0.0");
	console.log("Server listening on " + (config.ip || "0.0.0.0") + ":" + config.port);

	// Set up proxy IPs, if necessary
	if (config.behindProxy) {
		server.set('trust proxy', true);
	}

	// Set up our middleware
	server.use(loadConfig);
	server.use(checkAuthorized);

	// Set up our routes
	const rootPath = config.rootPath || "/";
	server.get(rootPath + "details/", loadAccounts, reqGetAllDetails);
	server.get(rootPath + "details/:username", loadAccounts, loadAccount, reqGetAccountDetails);
	server.get(rootPath + "code/:username", loadAccounts, loadAccount, reqGetCode);
	server.get(rootPath + "key/:username/:tag", loadAccounts, loadAccount, reqGetKey);
});

function loadConfig(req, res, next) {
	fs.readFile(__dirname + '/config.json', function(err, file) {
		if (err) {
			console.log("Cannot load config: " + err.message);
			res.status(500).send("<h1>500 Internal Server Error</h1>" + err.message);
			return;
		}

		req.appConfig = JSON.parse(file.toString('utf8'));
		next();
	});
}

function checkAuthorized(req, res, next) {
	if (!req.appConfig.restrictAccess) {
		next();
		return;
	}

	if (req.appConfig.allowedAddresses.indexOf(req.ip) == -1) {
		console.log("Access denied from remote IP " + req.ip);
		res.status(403).send("<h1>403 Forbidden</h1>Your IP address is not allowed to access this resource.");
		return;
	}

	// All good
	next();
}

function loadAccounts(req, res, next) {
	fs.readFile(__dirname + '/accounts.json', function(err, file) {
		if (err) {
			console.log(`Cannot read accounts: ${err.message}`);
			res.status(500).send("<h1>500 Internal Server Error</h1>" + err.message);
			return;
		}

		req.accDetails = JSON.parse(file.toString('utf8'));
		// Gross way of converting the keys to lowercase
		Object.keys(req.accDetails).forEach((username) => {
			let acc = req.accDetails[username];
			delete req.accDetails[username];
			req.accDetails[username.toLowerCase()] = acc;
		});
		next();
	});
}

function loadAccount(req, res, next) {
	if (req.params.username && typeof req.params.username === "string") {
		req.params.username = req.params.username.toLowerCase();
	}
	if (!req.params.username || !req.accDetails[req.params.username]) {
		res.status(404).send("<h1>404 Not Found</h1>No account data was found for that username.");
		return;
	}
	req.accDetails = req.accDetails[req.params.username];
	req.accDetails.username = req.params.username;
	next();
}

function reqGetAllDetails(req, res) {
	const accounts = req.accDetails;
	console.log("User requesting all details from " + req.ip);

	const data = {};
	let length = 0;
	for (let username in accounts) {
		const account = accounts[username];
		data[username] = {
			"password": account.password,
			"steamid": account.steamid,
			"nickname": account.nickname,
			"two_factor_code": account.shared_secret ? SteamTotp.generateAuthCode(account.shared_secret) : undefined,
		}
		length++;
	}
	res.send({
		data,
		length
	});
}

function reqGetAccountDetails(req, res) {
	console.log("User requesting details for " + req.accDetails.username + " from " + req.ip);
	res.send({
		"username": req.accDetails.username,
		"password": req.accDetails.password,
		"nickname": req.accDetails.nickname,
		"steamid": req.accDetails.steamid,
		"two_factor_code": req.accDetails.shared_secret ? SteamTotp.generateAuthCode(req.accDetails.shared_secret) : undefined
	});
}

function reqGetCode(req, res) {
	if (!req.accDetails.shared_secret) {
		res.status(404).send("<h1>404 Not Found</h1>No <code>shared_secret</code> was found for that username.");
		return;
	}
	
	console.log("User requesting login code for " + req.params.username + " from " + req.ip);
	res.send({"code":SteamTotp.generateAuthCode(req.accDetails.shared_secret)});
}

function reqGetKey(req, res) {
	console.log("User requesting confirmation key for " + req.params.username + ", tag " + req.params.tag + " from " + req.ip);

	var time = req.query.t ? parseInt(req.query.t, 10) : Math.floor(Date.now() / 1000);
	res.send({
		"time": time,
		"key": SteamTotp.getConfirmationKey(req.accDetails.identity_secret, time, req.params.tag)
	});
}
