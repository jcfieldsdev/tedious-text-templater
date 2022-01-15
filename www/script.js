/******************************************************************************
 * Tedious Text Templater                                                     *
 *                                                                            *
 * Copyright (C) 2022 J.C. Fields (jcfields@jcfields.dev).                    *
 *                                                                            *
 * Permission to use, copy, modify, and/or distribute this software for any   *
 * purpose with or without fee is hereby granted, provided that the above     *
 * copyright notice and this permission notice appear in all copies.          *
 *                                                                            *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES   *
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF           *
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR    *
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES     *
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN      *
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR *
 * IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.                *
 ******************************************************************************/

"use strict";

const STORAGE_NAME = "templater";
const TOKEN = "%%%";
const TRANSFORMS = {
	TRIM_WHITE_SPACE: 0b0_0001,
	LOWERCASE:        0b0_0010,
	UPPERCASE:        0b0_0100,
	HTML_ENTITIES:    0b0_1000,
	URL_ENCODE:       0b1_0000
};

/*
 * initialization
 */

window.addEventListener("load", function() {
	const templater = new Templater();
	templater.toggleButtons();

	const store = new Storage(STORAGE_NAME);
	templater.load(store.load() ?? {});

	window.addEventListener("beforeunload", function() {
		store.save(templater.save());
	});

	document.addEventListener("click", function(event) {
		const element = event.target;

		if (element.matches("#select")) {
			templater.selectField();
		}

		if (element.matches("#clear")) {
			templater.clearField();
		}

		if (element.closest(".copy")) {
			templater.copyToClipboard(element.closest(".copy").value);
		}

		if (element.matches(".transform")) {
			element.classList.toggle("active");

			const n = $$(".template").indexOf(element.closest(".template"));
			templater.setTransform(n, Number(element.value));
			templater.replaceText($("#text").value);
		}
	});
	document.addEventListener("input", function(event) {
		const element = event.target;

		if (element.matches("#token")) {
			templater.setToken(element.value);
		}

		if (element.matches("input, textarea")) {
			templater.replaceText($("#text").value);
			templater.toggleButtons();
		}
	});
	document.addEventListener("mouseover", function(event) {
		const element = event.target;

		if (element.matches(".copy")) {
			if (!element.disabled) {
				templater.highlightTemplate(Number(element.value));
			}
		}
	});
	document.addEventListener("mouseout", function(event) {
		const element = event.target;

		if (element.matches(".copy")) {
			if (!element.disabled) {
				templater.dimTemplate(Number(element.value));
			}
		}
	});
});

function $(selector) {
	return document.querySelector(selector);
}

function $$(selector) {
	return Array.from(document.querySelectorAll(selector));
}

/*
 * Templater prototype
 */

function Templater() {
	this.token = TOKEN;
	this.transforms = Array($$(".template").length).fill(0);
}

Templater.prototype.load = function(data) {
	const {text, token, inputs, transforms} = data;

	$("#text").value = text || "";
	$("#token").value = token || TOKEN;

	if (Array.isArray(inputs)) {
		for (const [n, element] of $$(".input").entries()) {
			element.value = inputs[n] || "";
		}
	}

	if (Array.isArray(transforms)) {
		this.transforms = transforms;

		const templates = $$(".template").length;

		for (const [n, element] of $$(".transform").entries()) {
			const index = Math.floor(n / templates);
			const state = transforms[index] & 1 << Number(element.value);
			element.classList.toggle("active", state);
		}
	}

	this.setToken($("#token").value);
	this.replaceText($("#text").value);
	this.toggleButtons();
};

Templater.prototype.save = function() {
	const inputs = $$(".input").map(function(element) {
		return element.value;
	});

	return {
		text: $("#text").value,
		token: $("#token").value,
		inputs,
		transforms: this.transforms
	};
};

Templater.prototype.selectField = function() {
	$("#text").select();
};

Templater.prototype.clearField = function() {
	const input = $("#text");
	input.value = "";
	input.focus();

	this.replaceText("");
};

Templater.prototype.highlightTemplate = function(n) {
	$$(".template")[n].classList.add("highlight");
};

Templater.prototype.dimTemplate = function(n) {
	$$(".template")[n].classList.remove("highlight");
};

Templater.prototype.toggleButtons = function() {
	const outputs = $$(".output");

	for (const [n, element] of $$(".copy").entries()) {
		element.disabled = outputs[n].value.length == 0;
	}
};

Templater.prototype.replaceText = function(text) {
	if (this.token == "") {
		return;
	}

	for (const [n, element] of $$(".template").entries()) {
		const input = element.querySelector(".input");
		const output = element.querySelector(".output");

		output.value = input.value.replaceAll(
			this.token,
			this.transformText(n, text)
		);
	}
};

Templater.prototype.transformText = function(n, text) {
	if (this.transforms[n] & TRANSFORMS.TRIM_WHITE_SPACE) {
		text = text.trim();
	}

	if (this.transforms[n] & TRANSFORMS.LOWERCASE) {
		text = text.toLowerCase();
	}

	if (this.transforms[n] & TRANSFORMS.UPPERCASE) {
		text = text.toUpperCase();
	}

	if (this.transforms[n] & TRANSFORMS.HTML_ENTITIES) {
		text = text.replaceAll("&", "&amp;");
		text = text.replaceAll("<", "&lt;");
		text = text.replaceAll(">", "&gt;");
	}

	if (this.transforms[n] & TRANSFORMS.URL_ENCODE) {
		text = window.encodeURI(text);
	}

	return text;
};

Templater.prototype.setToken = function(token) {
	this.token = token;
};

Templater.prototype.setTransform = function(n, value) {
	this.transforms[n] ^= 1 << value;
};

Templater.prototype.copyToClipboard = function(n) {
	try {
		const elements = $$(".template");
		elements[n].querySelector(".output").select();
		document.execCommand("copy");
	} catch (err) {
		console.warn("Could not copy to clipboard: ", err);
	}
};

/*
 * Storage prototype
 */

function Storage(name) {
	this.name = name;
}

Storage.prototype.load = function() {
	try {
		const contents = localStorage.getItem(this.name);

		if (contents != null) {
			return JSON.parse(contents);
		}
	} catch (err) {
		console.error(err);
		this.reset();
	}

	return {};
};

Storage.prototype.save = function(data) {
	try {
		if (data != undefined) {
			localStorage.setItem(this.name, JSON.stringify(data));
		} else {
			this.reset();
		}
	} catch (err) {
		console.error(err);
	}
};

Storage.prototype.reset = function() {
	try {
		localStorage.removeItem(this.name);
	} catch (err) {
		console.error(err);
	}
};