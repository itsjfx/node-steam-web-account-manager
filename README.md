# Steam Web Account Manager

This is a node.js web server that returns Steam two-factor login codes and login details for use in login and mobile trade confirmation.

You could maybe use this to separate your secrets from your accounts, or to make it easier to get codes for your
alternate accounts. You should use the official Steam app for any account with significant value.

This project is a fork (but standalone nonetheless) of steam-twofactor-server by DoctorMcKay: https://github.com/DoctorMcKay/steam-twofactor-server/ with the current additions:
- Accounts now have a password, nickname and steamid stored alongside the identity secret and shared secret.
- There is now an endpoint which lists the details (username, password, nickname and two factor code) for every account stored
- Accounts are stored in one file instead of seperate files, mainly because of the method above to reduce I/O
- The "key" endpoint is untouched, however the "code" endpoint which simply gives a 2FA code has been reworked to return a JSON instead of a `text/plain` response.
	- As the "key" endpoint has been untouched, this still means that the userscript works
- A neato frontend that I whipped up which lets users see all the accounts and their details and also regenerate 2FA codes
	- A simple page that uses jQuery to query the backend and modify the page, nothing fancy but it works nice
	- Make sure you modify the SERVER_URL variable in the JS for the frontend to point to your backend

Big shoutout to DoctorMcKay for his original work which inspired me for this project.

The idea of this project is to make a web based version of my Python steam account switcher.

## Configuration

Copy `config.sample.json` to `config.json` and edit the settings as you wish.

- `ip` - The IP address of the interface where the web server should listen. `0.0.0.0` for all interfaces
- `port` - The port that the web server should bind to
- `rootPath` - The root where the server should register its endpoints, with leading and trailing slashes.
	- For example, `/` will put all endpoints at `/endpoint` while `/2fa/` will put all endpoints at `/2fa/endpoint`.
	- This is designed for use with an HTTP proxy (like nginx or Apache).
- `behindProxy` - If your node server will be running behind an HTTP proxy like nginx, Apache, or CloudFlare, set this to `true`.
	- This will cause the server to use the `X-Forwarded-For` header for the remote client's IP address
- `restrictAccess` - `true` if you want to limit access by IP address (see `allowedAddresses`)
- `allowedAddresses` - An array of IP addresses that are allowed access if `restrictAccess` is `true`

You may have noticed that there's no options for HTTPS. This is currently unsupported. Use nginx as a proxy instead.

For frontend configuration please make sure you modify the SERVER_URL variable in the main.js file.

## Deployment

I recommend using nginx and running the api out of a directory (modify the rootpath for this) instead of just the root of a subdomain. I also recommend running the frontend on the same subdomain as the app, under the root directory. This stops any CORS issues you may run into when trying to make AJAX requests, and you can also use nginx to serve your frontend which is nice.

Using nginx also means you can use HTTPS/SSL and also add basic authentication to protect your accounts. If you want to use the mobile confirmer with basic authentication you can add the authentication to the url, e.g: https://user:password@example.com/api/

Below is a simple example of nginx location blocks that can do the trick.

```
server {
	location / {
    	auth_basic "Restricted Content";
        auth_basic_user_file /etc/nginx/.htpasswd;
		root /var/www/account-manager/html/;
	}

	location /api/ {
		auth_basic "Restricted Content";
		auth_basic_user_file /etc/nginx/.htpasswd;
		proxy_pass http://127.0.0.1:8080;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; 
		proxy_set_header Host $host;
		proxy_http_version 1.1;
	}
}
```

## Frontend

**BE SURE YOU MODIFY THE SERVER_URL variable in the main.js file in assets/js/main.js to point to your backend!**

Here's an example screenshot: 

![Example screenshot](https://i.imgur.com/kXrJrkh.png)

Any green text will be copied to clipboard on click.

with config:

```
{
	"test_account": {
		"shared_secret": "base64=",
		"identity_secret": "base64=",
		"steamid": "123456",
		"password": "",
		"nickname": "main smurf"
	},
	"test_account2": {
		"shared_secret": "base64=",
		"identity_secret": "base64=",
		"steamid": "123456", 
		"password": "",
		"nickname": "silver smurf"
	},
	"test_account3": {
		"shared_secret": "base64=",
		"identity_secret": "base64=",
		"steamid": "123456",
		"password": "",
		"nickname": "old main"
	},
	"test": {
		"password": "asdfasdf",
		"steamid": "123456"
	}
}
```

## Secrets

Put your accounts' in accounts.json with the same format as the sample file.

## Roadmap

The current version is very functional for my means, however roadmap for the future may be:
- Determine when the 2FA code is going to expire and automatically update on frontend, show progress bar like in the Steam app
- Vue app for front end
- User logins, with a permission setting for users, limit certain users from certain accounts etc
- Let people add and remove accounts, add permissions to get trade conf secrets etc
- SQLite DB
- Migration script for moving to new system

## Endpoints

To get actual codes, use the following endpoints

### /details/

Returns a JSON response containing user objects inside the object `data` where the keys are username with the user objects containing `password`, `steamid`, `nickname` and `two_factor_code`. A value `length` is also given which contains the number of accounts inside the `data` object.

#### Example
- Request: `GET /details/`
	- Response: `{"data":{"USERNAME":{"password":"","steamid":"","nickname":"","two_factor_code":""}},"length":1}`

### /details/:username

Returns a JSON response containing a single object containing `username`, `password`, `steamid`, `nickname` and `two_factor_code`.

#### Example
- Request: `get /details/test_account/`
	- Response: `{"username":"test_account","password":"","nickname":"","steamid":"","two_factor_code":""}`

### /code/:username
- `username` - Your account's username

Returns a JSON response containing your account's current 5-digit alphanumeric login code.

#### Example

- Request: `GET /code/test_account`
	- Response: `{"code":"YD6DX"}`

### /key/:username/:tag
- `username` - Your account's username
- `tag` - The `tag` for this request

Returns a JSON response containing the current `time` and the `key` encoded in base64. These are to be used with the
mobile confirmations page on steamcommunity.com.

**Optional:** You can override the time using `?t=unixtime`.

### Example

- Request: `GET /key/test_account/conf`
    - Response: `{"time":1449086709,"key":"ev5vtBxVGJ2kcbvPWlaFEY8oFow="}`
- Request: `GET /key/test_account/conf?t=1449086710`
	- Response: `{"time":1449086710,"key":"1KrL/3IEsZ98sl/rP9uDRvErWJE="}`

## HTTP Response Codes

- `200` - The request completed successfully and you should have received a valid response
- `403` - Your IP is not whitelisted
- `404` - No secret file was found for that account (or bad endpoint)
- `500` - Some unexpected error occurred, likely in file I/O

If an error occurs, the response body will contain more information.
