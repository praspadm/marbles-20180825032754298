/* global formatDate */
/* global nDig */
/* global randStr */
/* global bag */
/* global $ */
var ws = {};
var bgcolors = ["whitebg", "blackbg", "redbg", "greenbg", "bluebg", "purplebg", "pinkbg", "orangebg", "yellowbg"];

// =================================================================================
// On Load
// =================================================================================
$(document).on('ready', function() {
	connect_to_server();
	$("input[name='name']").val('r' + randStr(6));
	
	// =================================================================================
	// jQuery UI Events
	// =================================================================================
	$("#submit").click(function(){
		console.log('creating marble');
		var obj = 	{
						type: "create",
						name: $("input[name='name']").val(),
						color: $(".colorSelected").attr('color'),
						size: $("select[name='size']").val(),
						user: $("select[name='user']").val(),
						v: 1
					};
		if(obj.user && obj.name && obj.color){
			console.log('sending', obj);
			ws.send(JSON.stringify(obj));
			showAdminPanel();
			$(".colorValue").html('Color');											//reset
			for(var i in bgcolors) $(".createball").removeClass(bgcolors[i]);			//reset
			$(".createball").css("border", "2px dashed #fff");						//reset
		}
		return false;
	});
	
	$("#homeLink").click(function(){
		showAdminPanel();
	});

	$("#createLink").click(function(){
		$("input[name='name']").val('r' + randStr(6));
	});

	
	//marble color picker
	$(document).on("click", ".colorInput", function(){
		$(this).parent().find('.colorOptionsWrap').show();
	});
	$(document).on("click", ".colorOption", function(){
		var color = $(this).attr('color');
		var html = '<span class="fa fa-circle colorSelected ' + color + '" color="' + color +'"></span>';
		
		$(this).parent().parent().find('.colorValue').html(html);
		$(this).parent().hide();

		for(var i in bgcolors) $(".createball").removeClass(bgcolors[i]);			//remove prev color
		$(".createball").css("border", "0").addClass(color + 'bg');				//set new color
	});
	
	
	//drag and drop marble
	$("#leroyswrap, #bobswrap, #trashbin").sortable({connectWith: ".sortable"}).disableSelection();
	$("#leroyswrap").droppable({drop:
		function( event, ui ) {
			var user = $(ui.draggable).attr('user');
			if(user.toLowerCase() != 'leroy'){
				$(ui.draggable).addClass("invalid");
				transfer($(ui.draggable).attr('id'), 'leroy');
			}
		}
	});
	$("#bobswrap").droppable({drop:
		function( event, ui ) {
			var user = $(ui.draggable).attr('user');
			if(user.toLowerCase() != 'bob'){
				$(ui.draggable).addClass("invalid");
				transfer($(ui.draggable).attr('id'), 'bob');
			}
		}
	});
	$("#trashbin").droppable({drop:
		function( event, ui ) {
			var id = $(ui.draggable).attr('id');
			if(id){
				console.log('removing marble', id);
				var obj = 	{
								type: "remove",
								name: id,
								v: 1
							};
				ws.send(JSON.stringify(obj));
				$(ui.draggable).fadeOut();
				setTimeout(function(){
					$(ui.draggable).remove();
				}, 300);
				showAdminPanel(true);
			}
		}
	});
	
	
	// =================================================================================
	// Helper Fun
	// ================================================================================
	//show admin panel page
	function showAdminPanel(reset){
		$("#homePanel").fadeIn(300);
		$("#createPanel").hide();
		if(reset === true){
			setTimeout(function(){
				$("#bobswrap").html('');
				$("#leroyswrap").html('');
			}, 300);
		}
		console.log('getting new balls');
		setTimeout(function(){
			$("#bobswrap").html('');
			$("#leroyswrap").html('');
			ws.send(JSON.stringify({type: "get", v: 1}));						//need to wait a bit - dsh to do, tap into new block event
			ws.send(JSON.stringify({type: "chainstats", v: 1}));
		}, 300);
	}
	
	//transfer selected ball to user
	function transfer(marbleName, user){
		if(marbleName){
			console.log('transfering', marbleName);
			var obj = 	{
							type: "transfer",
							name: marbleName,
							user: user,
							v: 1
						};
			ws.send(JSON.stringify(obj));
			showAdminPanel(true);
		}
	}
});


// =================================================================================
// Socket Stuff
// =================================================================================
function connect_to_server(){
	connect();
	function connect(){
		var wsUri = "ws://" + bag.setup.SERVER.EXTURI;
		ws = new WebSocket(wsUri);
		ws.onopen = function(evt) { onOpen(evt); };
		ws.onclose = function(evt) { onClose(evt); };
		ws.onmessage = function(evt) { onMessage(evt); };
		ws.onerror = function(evt) { onError(evt); };
	}
	
	function onOpen(evt){
		console.log("WS CONNECTED");
		//ws.send(JSON.stringify({type: "get", v:1}));
		ws.send(JSON.stringify({type: "chainstats", v:1}));
		setTimeout(function(){
			ws.send(JSON.stringify({type: "get", v:1}));
		}, 300);
	}

	function onClose(evt){
		console.log("WS DISCONNECTED", evt);
		setTimeout(function(){ connect(); }, 5000);					//try again one more time, server restarts are quick
	}

	function onMessage(msg){
		try{
			var data = JSON.parse(msg.data);
			console.log('rec', data);
			if(data.marble){
				build_ball(data.marble);
			}
			else if(data.msg === 'chainstats'){
				var e = formatDate(data.blockstats.transactions[0].timestamp.seconds * 1000, '%M/%d/%Y &nbsp;%I:%m%P');
				$("#blockdate").html('<span style="color:#fff">TIME</span>&nbsp;&nbsp;' + e + ' UTC');
				var temp = { 
								id: nDig((data.chainstats.height - 1), 3), 
								blockstats: data.blockstats
							};
				new_block(temp);									//send to blockchain.js
			}
		}
		catch(e){
			console.log('ERROR', e);
			//ws.close();
		}
	}

	function onError(evt){
		console.log('ERROR ', evt.data);
	}

	function sendMessage(message){
		console.log("SENT: " + message);
		ws.send(message);
	}
}


// =================================================================================
//	UI Building
// =================================================================================
function build_ball(data){
	var html = '';
	var colorClass = '';
	var size = 'fa-5x';
	
	if(!$("#" + data.name).length){								//only populate if it doesn't exists
		if(data.size == 16) size = 'fa-3x';
		if(data.color) colorClass = data.color.toLowerCase();
		
		html += '<span id="' + data.name +'" class=" fa fa-circle ' + size + ' ball ' + colorClass + '" title="' + data.name +'" user="' + data.user + '"></span>';
		if((data.user && data.user.toLowerCase() == 'bob') || (data.owner && data.owner.toLowerCase() == 'bob')){
			$("#bobswrap").append(html);
		}
		else{
			$("#leroyswrap").append(html);
		}
	}
	return html;
}