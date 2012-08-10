


var Tourn = {
	ByeTeam: function(count, index) {
		var players = [];
		for (var i=0;i<count;i++) {
			players.push({name: 'BYE'});
		}
		var team = new Tourn.Team(players, index);
		team.isBye = true;
		return team;
	},
	ByeMatch: function(count, index) {
		var match = new Tourn.Match();
		index++;
		match.addTeam(Tourn.ByeTeam(count, index), 1);
		match.addTeam(Tourn.ByeTeam(count, index + 1), 0);
		match.setWinner(0);
		match.isBye = true;
		return match;
	},
	Styles: {
		borderWidth: 1,
		borderColor: '#990066',
		borderRadius: 0,
		background: '#333333',
	}
};


Tourn.Node = new Class({
	Implements: Options,
	options: {
		
	},
	initialize: function(geometry) {
		this.setGeometry(geometry);
	},
	setGeometry: function(geometry) {
		var geometry = geometry || {};
		this.geometry = Object.merge({x:0,y:0,width:0,height:0}, geometry);
	},
	draw: function(ctx, style) {
		var style = style || {};
		style = Object.merge(Tourn.Styles, style);
		
		ctx.save();
		// Set styles
		ctx.strokeStyle = style.borderColor;
		ctx.lineWidth = style.borderWidth;
		
		ctx.strokeRect(
			this.geometry.x + 0.5 - style.borderWidth,
			this.geometry.y + 0.5 - style.borderWidth,
			this.geometry.width + 0.5 - style.borderWidth,
			this.geometry.height + 0.5 - style.borderWidth
		);
		ctx.restore();
		
		return this;
	}
});


Tourn.Team = new Class({
	Extends: Tourn.Node,
	options: {
		index: -1,
		data: {}
	},
	initialize: function(players, index, data, options) {
		this.parent(options);
		this.players = players;
		this.index = index || -1;
		this.data = data || {};
		
		this.parentNode = null;
		this.isBye = false;
	},
	toJSON: function() {
		return {players: this.players, bye: this.isBye};
	}
});

Tourn.Match = new Class({
	Extends: Tourn.Node,
	initialize: function(options) {
		this.parent(options);
		this.parentNode = null;
		this.clear();
		this.isBye = false;
	},
	addTeam: function(team, index) {
		var index = (index === undefined) ? 0 : index;
		switch(this.teams.length) {
			case 0:
				this.teams.push(team);
				break;
			case 1:
				if (this.teams[0].players != team.players) {
					this.teams.push(team);
				}
				break;
			case 2:
				if (this.teams[0].players != team.players && this.teams[1].players != team.players) {
					this.teams.push(team);
				}
				break;
		};
		team.parentNode = this;
	},
	setWinner: function(team) {
		if (typeof(team) == 'number') {
			var winner = this.teams[team];
			var loser = (team == 0) ? this.teams[1] : this.teams[0];
		}
		else {
			var winner = (team == this.teams[0]) ? this.teams[0] : this.teams[1];
			var loser = (team == this.teams[0]) ? this.teams[1] : this.teams[0];
		}
		this.winner = winner;
		
		return this.winner;
	},
	clear: function() {
		this.teams = []
		this.winner = null;
	},
	toJSON: function() {
		var teams = [];
		this.teams.each(function(team) {
			teams.push(team.toJSON());
		}, this);
		
		return {teams: teams, winner: this.teams.indexOf(this.winner)};
	}
});

Tourn.Round = new Class({
	Extends: Tourn.Node,
	initialize: function(options) {
		this.parent(options);
		this.matches = [];
	},
	addMatch: function(match) {
		this.matches.push(match);
		match.parentNode = this;
	},
	toJSON: function() {
		var matches = [];
		this.matches.each(function(match) {
			matches.push(match.toJSON());
		}, this);
		
		return matches;
	}
});

Tourn.Bracket = new Class({
	Implements: [Events, Options],
	options: {
		scaleFonts: true,
		reverse: false,
		playerIndex: true,
		roundSpacing: 1,
		onWinner: function(){},
		onSave: function(){},
		onLoad: function(){}
	},
	initialize: function(element, options) {
		this.setOptions(options);
		this.element = $(element);
		this.canvas = new Element('canvas', {width: this.element.getWidth(), height: this.element.getHeight()}).inject(this.element);
		this.ctx = this.canvas.getContext('2d');
		this.container = new Element('div', {'class': 'tourn-main'}).inject(this.element);
		this.teams = [];
		// this.rounds = [];
		// var matches = this.initMatches();
		// this.drawRounds();
		// this.drawMatches(matches);
	},
	toElement: function() {
		return this.container;
	},
	clear: function() {
		this.rounds = [];
		this.container.empty();
	},
	drawRounds: function() {
		var numCols = (Math.round(Math.sqrt(this.teams.length))) + 1;
		var roundWidth = this.container.getWidth() / numCols + this.options.roundSpacing;
		roundWidth = roundWidth.toInt();
		for (var i=0;i<numCols;i++) {
			var round = new Tourn.Round({
				x: roundWidth * i + this.options.roundSpacing,
				y: 0,
				width: roundWidth - this.options.roundSpacing,
				height: this.canvas.height
			});
			//this.ctx.strokeRect(roundWidth * i + this.options.roundSpacing, 0, roundWidth - this.options.roundSpacing, this.canvas.height);
			round.draw(this.ctx);
			this.rounds.push(round);
		}
	},
	drawFirstRound: function(round, matches) {
		var matchHeight = this.container.getHeight() / (this.teams.length / 2);
		var top = 0;
		var teamHeight;
		for (var i=0;i<matches.length;i++) {
			var match = matches[i];
			match.setGeometry({
				y: top,
				width: round.geometry.width,
				height: matchHeight
			});
			match.draw(this.ctx);
			
			round.addMatch(match);

			if (!teamHeight) {
				teamHeight = match.geometry.height / 2;
			}

			top += matchHeight;
		}
		this.teamHeight = teamHeight;
	},
	drawMatches: function(matches) {
		var self = this;
		var teamLength = self.teams.length;
		var coords = this.container.getCoordinates();
		
		this.teamHeight;

		this.rounds.each(function(round, idx) {
			if (idx == 0) {
				self.drawFirstRound(round, matches);
				self.setTeamSize();
			}
			else {
				var prevCol = self.rounds[idx - 1];
				var h;
				for (var i=0;i<prevCol.matches.length;i=i+2) {
					var matchTop = prevCol.matches[i];
					var matchBot = prevCol.matches[i + 1];
					var teamCenter = self.teamHeight / 2;
					if (!matchBot) {
						var m = new Tourn.Match();
						m.setGeometry({
							y: round.geometry.height / 2 - teamCenter,
							height: self.teamHeight
							
						})
						
						round.addMatch(m);
						break;
					}
					var m = new Tourn.Match();
					// var top = $(matchTop).getCoordinates();
					// var bot = $(matchBot).getCoordinates();
					
					var t = matchTop.geometry.y + (matchTop.geometry.height / 2) - teamCenter;
					if (!h) {
						h = (matchBot.geometry.height - matchTop.geometry.y) - t - teamCenter;
					}
					m.setGeometry({
						x: round.geometry.x,
						y: t,
						width: 32,
						height: h
					});
					console.log(round.geometry.x,t)
					
					round.addMatch(m);
				}
			}
		});
		
	},
	update: function() {
		for (var r=0;r<this.rounds.length;r++) {
			if (r > 0) {
				var prev = this.rounds[r - 1];
				var round = this.rounds[r];
				var match;
				for (var m=0;m<prev.matches.length;m++) {
					if (m == 0) {
						match = round.matches[m];
					}
					if ((m % 2) == 0) {
						match = round.matches[m/2];
					}
					var prevMatch = prev.matches[m];
					if (!prevMatch.winner) {
						continue;
					}
					if (prevMatch.winner.isBye) {
						var team = Tourn.ByeTeam(prevMatch.winner.players.length, prevMatch.winner.index);
					}
					else {
						var team = new Tourn.Team(prevMatch.winner.players, prevMatch.winner.index);
					}
					var pos = (prevMatch.parentNode.matches.indexOf(prevMatch) % 2) ? 0 : 1;
					match.addTeam(team, pos);
					if (match.teams.length == 2) {
						if (match.teams[0].isBye) match.setWinner(1);
						if (match.teams[1].isBye) match.setWinner(0);
					}
				}
			}
		}
		if (this.options.reverse) {
			var lefts = [];
			this.rounds.each(function(round) {
				lefts.push($(round).getStyle('left').toInt());
			});
			lefts.reverse();
			for (var i=0;i<this.rounds.length;i++) {
				var round = this.rounds[i];
				$(round).setStyle('left', lefts[i]);
			}
		}
		this.setTeamSize();
	},
	setTeamSize: function() {
		var playerFontSize;
		$$('.tourn-team').each(function(team) {
			team.setStyle('height', this.teamHeight);
		}, this);
		// playerFontSize = this.teamHeight / $$('.tourn-teamplayers')[0].children.length;
		// if (this.options.scaleFonts) {
			// $$('.tourn-player,.tourn-teamindex').each(function(player) {
				// player.setStyle('font-size', playerFontSize)
			// })
		// }
	},
	load: function(data) {
		var self = this;
		this.clear();
		var round = data.rounds[0];
		var matches = [];
		var teams = [];
		round.each(function(match) {
			var m = new Tourn.Match();
			for (var j=0;j<match.teams.length;j++) {
				teams.push(match.teams[j]);
				var index = (self.options.playerIndex) ? teams.length : -1;
				if (match.teams[j].bye) {
					var team = Tourn.ByeTeam(teams[0].players.length, index);
				}
				else {
					var team = new Tourn.Team(match.teams[j].players, index);
				}
				
				var pos = (m.teams.length == 1) ? 0 : 1;
				m.addTeam(team, pos);
			}
			matches.push(m);
		});
		i = 2;
		while (teams.length > i) {
			i *= 2;
		}
		while (teams.length != i) {
			var index = (self.options.playerIndex) ? teams.length : -1;
			var match = Tourn.ByeMatch(teams[0].players.length, index);
			teams.push(match.teams[0].toJSON());
			teams.push(match.teams[1].toJSON());
			matches.push(match);
		}
		
		this.teams = teams;
		this.drawRounds();
		this.drawMatches(matches);
		// var lastRound = data.rounds.getLast();
		// data.rounds.each(function(round, idx) {
			// if (round != lastRound) {
				// round.each(function(match, i) {
					// self.rounds[idx].matches[i].setWinner(match.winner);
				// });
			// }
		// });
		// this.update();
		
		this.fireEvent('load');
	},
	save: function() {
		var obj = {};
		var rounds = [];
		this.rounds.each(function(round) {
			rounds.push(round.toJSON());
		});
		obj.rounds = rounds;
		
		this.fireEvent('save', [obj]);
		
		return JSON.stringify(obj);
	},
	setWinner: function(r,m,w) {
		var winner = this.rounds[r].matches[m].setWinner(w);
		this.fireEvent('winner', [winner]);
		this.update();
	}
});