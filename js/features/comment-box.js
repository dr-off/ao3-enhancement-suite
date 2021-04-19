function switchToFloatingCommentBox(commentBox, opacity)
{
	commentBox.classList.add("aes-fcb");
	commentBox.style = `top: 0px; left: 0px; opacity: ${ opacity };`;
	document.body.appendChild(commentBox);
}

function switchToStaticCommentBox(commentBox)
{
	commentBox.classList.remove("aes-fcb");
	commentBox.style = "";
	document.getElementById("feedback").insertBefore(commentBox, document.getElementById("comments_placeholder"));
}

async function insertSelection(textarea)
{
	let rawSelection = window.getSelection().toString().split("\r\n");

	let processedSelection = [];

	for(let line of rawSelection)
	{
		if(line == "")
			continue;

		switch(await Setting.get("cb_insert_formatting"))
		{
			case "bold":
				processedSelection.push(`<b>${ line }</b>`);
				break;

			case "italics":
				processedSelection.push(`<i>${ line }</i>`);
				break;

			case "none":
			default:
				processedSelection.push(line);
		}
	}

	if(processedSelection.length == 0)
		return;

	textarea.value += processedSelection.join("\r\n\r\n") + "\r\n\r\n";

	if(await Setting.get("cb_focus_after_insert"))
		textarea.focus();

	textarea.dispatchEvent(new Event("input"));
};

function clipCommentBox(mainElement)
{
	let scrollbarWidth = window.innerWidth - document.documentElement.clientWidth; // HACK
	let mainElementRect = mainElement.getBoundingClientRect();

	let maxX = window.innerWidth - scrollbarWidth - mainElementRect.width;
	if(maxX < 0)
		maxX = 0;

	let maxY = window.innerHeight - 30;
	if(maxY < 0)
		maxY = 0;

	if(mainElement.offsetLeft > maxX)
		mainElement.style.left = maxX.toString() + "px";

	if(mainElement.offsetTop > maxY)
		mainElement.style.top = maxY.toString() + "px";
}

// Based on this W3 example
//		https://www.w3schools.com/howto/howto_js_draggable.asp
function makeElementDraggable(mainElement, headerElement) 
{
	let pos1 = 0;
	let pos2 = 0;
	let pos3 = 0;
	let pos4 = 0;

	function mouseDown(event) 
	{
		event = event || window.event;
		event.preventDefault();

		// Calculate the ew cursor position
		pos1 = pos3 - event.clientX;
		pos2 = pos4 - event.clientY;
		pos3 = event.clientX;
		pos4 = event.clientY;

		// Set the element's new position
		let newX = mainElement.offsetLeft - pos1;
		if(newX < 0)
			newX = 0;

		let newY = mainElement.offsetTop - pos2;
		if(newY < 0)
			newY = 0;

		mainElement.style.left = newX.toString() + "px";
		mainElement.style.top = newY.toString() + "px";

		clipCommentBox(mainElement);
	}

	function mouseUp() 
	{
		// stop moving when mouse button is released:
		document.removeEventListener("mousemove", mouseDown);
		document.removeEventListener("mouseup", mouseUp);
	}

	function dragMouseDown(e) 
	{
		e = e || window.event;
		e.preventDefault();

		// get the mouse cursor position at startup:
		pos3 = e.clientX;
		pos4 = e.clientY;

		// call a function whenever the cursor moves:
		document.addEventListener("mousemove", mouseDown);
		document.addEventListener("mouseup", mouseUp);
	}
		
	headerElement.addEventListener("mousedown", dragMouseDown);

	window.addEventListener("resize", function(event)
	{
		clipCommentBox(mainElement);
	});
}

(async function()
{
	const settings = await Setting.getAll();

	const commentBox = document.getElementById("add_comment_placeholder");
	if(commentBox == null)
		return;

	commentBox.classList.add("aes-cb");

	if(settings.enable_floating_comment_box)
		switchToFloatingCommentBox(commentBox, settings.cb_floating_opacity);

	const fieldset = commentBox.querySelector("fieldset");

	const moveHeader = document.createElement("div");
	moveHeader.classList.add("aes-move-header");
	moveHeader.innerText = browser.i18n.getMessage("fieldset_title", [ browser.i18n.getMessage("name_acronym"), browser.i18n.getMessage("floating_comment_box") ] );
	commentBox.prepend(moveHeader);

	makeElementDraggable(commentBox, moveHeader);
	
	let fcbRecommendation = document.createElement("p");
	fcbRecommendation.classList.add("footnote");
	fcbRecommendation.classList.add("aes-fcb-recommendation");
	
	fcbRecommendation.appendChild(document.createTextNode(`(${ browser.i18n.getMessage("cb_recommendation", [ browser.i18n.getMessage("name") ]) } `));

	{
		let fcbRecommendationHelp = new HelpButton("?", browser.i18n.getMessage("settings"), function(event)
		{
			aesDropdown.getItem("settings").onClick();
		});
	
		fcbRecommendation.appendChild(fcbRecommendationHelp.element);
	}
	
	fcbRecommendation.appendChild(document.createTextNode(")"));

	fieldset.append(fcbRecommendation);

	const heading = fieldset.querySelector("h4.heading");
	if(settings.cb_hide_comment_as_heading)
		heading?.classList.add("aes-hidden");

	const footnote = fieldset.querySelector(".footnote");
	if(settings.cb_hide_html_footnote)
		footnote.classList.add("aes-hidden");

	const textarea = fieldset.querySelector("textarea");

	let timeout;
	textarea.addEventListener("input", async function(event)
	{
		// Not using "settings" here so the setting can be changed without reloading the page
		if(!await Setting.get("save_comments_to_storage")) 
			return;

		if(timeout != undefined)
			clearTimeout(timeout);

		timeout = setTimeout(function()
		{
			let workId = "work_" + textarea.id.substr(20);

			let storage =
			{
				savedComments: {},
			}

			storage.savedComments[workId] = textarea.value;

			browser.storage.local.set(storage);
		}, 1000);
	});

	if(settings.save_comments_to_storage)
	{
		let savedComments = (await browser.storage.local.get("savedComments"))?.savedComments;
		if(savedComments == undefined)
			savedComments = {};

		let workId = textarea.id.substr(20);

		let savedComment = savedComments["work_" + workId];

		if(savedComment != undefined)
			textarea.value = savedComment;
	}

	let controlSet;
	if(settings.cb_enable_additional_controls)
	{
		controlSet = new ControlSet();
		controlSet.element.classList.add("aes-cb-actions");
		if(!settings.cb_hide_html_footnote)
			controlSet.element.classList.add("aes-footnote-offset");
	
		const insert = controlSet.addControl("Insert Selection", function(event)
		{
			insertSelection(textarea);
		});
	
		insert.title = browser.i18n.getMessage("cb_insert_tooltip");
	
		fieldset.insertBefore(controlSet.element, textarea.parentElement);
	}

	browser.storage.onChanged.addListener(function(changes, areaName)
	{
		if(areaName == "local")
		{
			if(changes.settings.oldValue?.enable_floating_comment_box != changes.settings.newValue?.enable_floating_comment_box)
			{
				if(changes.settings.newValue?.enable_floating_comment_box)
					switchToFloatingCommentBox(commentBox, changes.settings.newValue.cb_floating_opacity);
				else
					switchToStaticCommentBox(commentBox);
			}

			if(changes.settings.newValue?.enable_floating_comment_box)
				commentBox.style.opacity = changes.settings.newValue.cb_floating_opacity;

			if(changes.settings.oldValue?.cb_hide_comment_as_heading != changes.settings.newValue?.cb_hide_comment_as_heading)
			{
				if(changes.settings.newValue?.cb_hide_comment_as_heading)
					heading?.classList.add("aes-hidden");
				else
					heading?.classList.remove("aes-hidden");
			}
			
			if(changes.settings.oldValue?.cb_hide_html_footnote != changes.settings.newValue?.cb_hide_html_footnote)
			{
				if(changes.settings.newValue?.cb_hide_html_footnote)
				{
					footnote?.classList.add("aes-hidden");
					controlSet?.element.classList.remove("aes-footnote-offset");
				}
				else
				{
					footnote?.classList.remove("aes-hidden");
					controlSet?.element.classList.add("aes-footnote-offset");
				}
			}
		}
	});
})();