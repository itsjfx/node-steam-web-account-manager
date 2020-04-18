const SERVER_URL = 'http://example.com/api'; // no trailing /

function copyToClipboard(text) {
	let textArea = document.createElement("textarea");
	textArea.value = text;
	document.body.appendChild(textArea);
	textArea.select();
	document.execCommand("Copy");
	textArea.remove();
}

$(function() {
	$("#accounts tbody").on("click", ".toggle-password", function() {
		const account = $(this);
		const password = $('#password_'+account.attr('username'));

		if (password.is(":visible")) {
			$(this).text('View');
		} else {
			$(this).text('Hide');
		}

		password.toggle();
	});

	$("#accounts tbody").on("click", ".get-new-2fa", function() {
		const account = $(this);
		const username = account.attr('username');

		$.getJSON(`${SERVER_URL}/code/${username}`)
		.done(resp => {
			$(`#2fa_${username}`).text(resp.code);
		})
		.fail(err => {
			console.log(err);
		});
	});

	$("#accounts tbody").on("click", ".username, .two_factor_code, .password", function() {
		copyToClipboard($(this).text());
	});

	$.getJSON(`${SERVER_URL}/details`)
	.done(resp => {
		const res = resp.data;
		for (let username of Object.keys(res)) {
			const account = res[username];
			$("#accounts tbody").append(`
				<tr id="${username}">
					<td>
						<span class="username">${username}</span> ${account.nickname ? `(${account.nickname})` : ''}
					</td>
					<td>
						${account.password ? `<span id="password_${username}" class="hide-by-default password">${account.password}</span> <a username="${username}" class="toggle-password" href="#">View</a>` : 'None'}
					</td>
					<td>
						${account.two_factor_code ? `<span id="2fa_${username}" class="two_factor_code">${account.two_factor_code}</span> <a username="${username}" class="get-new-2fa" href="#">Get New 2FA</a>` : `None`}
					</td>
					<td>
						${account.steamid ? `<a class="steamid" href="https://steamcommunity.com/profiles/${account.steamid}" target="_blank">Steam Profile (${account.steamid})</a>` : 'None'}
					</td>
				</tr>
			`);
		}
	})
	.fail(err => {
		console.log("Failed", err);
	});
});