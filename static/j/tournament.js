


var Tourn = {
	ByeTeam: function(name, index, options) {
		var players = [name];
		var team = new Tourn.Team(players, index, options);
		$(team).addClass('tourn-bye');
		team.isBye = true;
		return team;
	},
	ByeMatch: function(name, index, options) {
		var match = new Tourn.Match();
		var t1 = match.addTeam(Tourn.ByeTeam(name, index, options), 0);
		var t2 = match.addTeam(Tourn.ByeTeam(name, index + 1, options), 1);
		match.setWinner(t1);
		match.isBye = true;
		return match;
	},
	Styles: {
		borderWidth: 1,
		borderColor: '#000000',
		borderRadius: 0,
		background: '#333333',
	}
};


Tourn.Node = new Class({
	Implements: Options,
	options: {
		geometry: {x:0,y:0,width:0,height:0}
	},
	initialize: function(options, index) {
		this.setOptions(options);
		this.index = (index === undefined) ? -1 : index;
		this.element = new Element('div');
	},
	toElement: function() {
		return this.element;
	},
	draw: function(ctx, style) {
		var style = style || {};
		style = Object.merge(Tourn.Styles, style);
		
		ctx.save();
		
		ctx.strokeRect(this.geometry.x, this.geometry.y, this.geometry.width, this.geometry.height);
	}
});


Tourn.Team = new Class({
	Extends: Tourn.Node,
	Implements: Events,
	options: {
		index: -1,
		data: {},
		onClick: function(){}
	},
	initialize: function(players, index, options) {
		this.parent(options, index);
		this.element.addClass('tourn-team');
		this.element.addEvent('click', this.clickEvent.bind(this));
		this.players = players;
		this.data = this.options.data;
		
		var wrap = new Element('div').inject(this.element);
		
		new Element('span', {'class': 'tourn-teamindex', 'text': index + 1}).inject(wrap)
		for (var i=0;i<players.length;i++) {
			new Element('span', {
				'class': 'tourn-player',
				'text': players[i].name
			}).inject(wrap);
		}
		
		this.parentNode = null;
		this.isBye = false;
	},
	clickEvent: function(e) {
		this.fireEvent('onClick', [this.parentNode.parentNode.index, this.parentNode.index, this.index]);
	},
	toJSON: function() {
		return {players: this.players, bye: this.isBye, index: this.index};
	}
});

Tourn.Match = new Class({
	Extends: Tourn.Node,
	initialize: function(index) {
		this.parent({}, index);
		this.element.addClass('tourn-match');
		this.parentNode = null;
		this.clear();
		this.isBye = false;
		this.winner = null;
	},
	addTeam: function(team, index) {
		var index = (index === undefined) ? 0 : index;
		var cls = (index === 0) ? 'tourn-team1' : 'tourn-team2';
		var el = $(team).clone().cloneEvents($(team));
		
		switch(this.teams.length) {
			case 0:
				this.teams.push(team);
				el.addClass(cls)
				this.element.grab(el);
				break;
			case 1:
				var teamIndex = index ? 0 : 1;
				if (this.teams[0].players != team.players) {
					this.teams.push(team);
					el.addClass(cls)
					this.element.grab(el);
				}
				break;
			case 2:
				if (this.teams[0].players != team.players && this.teams[1].players != team.players) {
					this.teams.push(team);
				}
				break;
		};
		team.parentNode = this;
		
		return team;
	},
	setWinner: function(team) {
		if (!this.winner && this.teams.length == 2) {
			if (typeof(team) == 'number') {
				var winner = this.teams[team];
				var loser = (team == 0) ? this.teams[1] : this.teams[0];
			}
			else {
				var winner = (team == this.teams[0]) ? this.teams[0] : this.teams[1];
				var loser = (team == this.teams[0]) ? this.teams[1] : this.teams[0];
			}
			if (winner) {
				$(winner).addClass('tourn-win');
			}
			if (loser) {
				$(loser).addClass('tourn-lose');
			}
			this.winner = winner;
		}
		
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
		
		return {teams: teams, winner: this.winner};
	}
});

Tourn.Round = new Class({
	Extends: Tourn.Node,
	initialize: function(index) {
		this.parent({}, index);
		this.element.addClass('tourn-round');
		this.matches = [];
	},
	addMatch: function(match) {
		this.matches.push(match);
		this.element.grab($(match))
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
		initialSpacing: 0,
		byeTeam: {name: 'BYE'},
		onWinner: function(){},
		onSave: function(){},
		onLoad: function(){},
		onTeamClick: function(){}
	},
	initialize: function(element, options) {
		this.setOptions(options);
		this.element = $(element);
		this.container = new Element('div', {'class': 'tourn-main'}).inject(this.element);
		this.teams = [];
	},
	toElement: function() {
		return this.container;
	},
	clear: function() {
		this.rounds = [];
		this.teams = [];
		this.container.empty();
	},
	drawRounds: function() {
		var numCols = (Math.round(Math.sqrt(this.teams.length))) + 1;
		var roundWidth = this.container.getWidth() / numCols;
		roundWidth = Math.floor(roundWidth);
		for (var i=0;i<numCols;i++) {
			var round = new Tourn.Round(i);
			$(round).setStyles({
				top: 0,
				left: roundWidth * i,
				width: roundWidth - this.options.roundSpacing,
				height: this.container.getHeight()
			}).inject(this.container);
			
			this.rounds.push(round);
		}
	},
	drawFirstRound: function(round, matches) {
		var matchHeight = this.container.getHeight() / (this.teams.length / 2) - this.options.initialSpacing;
		var top = 0;
		var teamHeight;
		for (var i=0;i<matches.length;i++) {
			var match = matches[i];
			$(match).setStyles({
				top: top,
				height: matchHeight
			});
			round.addMatch(match);

			if (!teamHeight) {
				teamHeight = $(match).getHeight() / 2;
			}

			top += matchHeight + this.options.initialSpacing;
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
						var m = new Tourn.Match(i);
						$(m).setStyles({
							top: $(round).getHeight() / 2 - teamCenter,
							height: self.teamHeight
						});
						round.addMatch(m);
						break;
					}
					var m = new Tourn.Match(round.matches.length);
					var top = $(matchTop).getCoordinates();
					var bot = $(matchBot).getCoordinates();
					
					var t = (top.top - coords.top) + (top.height / 2) - teamCenter;
					if (!h) {
						h = (bot.bottom - top.top) - t - teamCenter;
					}
					
					$(m).setStyles({
						top: t,
						height: h
					});
					round.addMatch(m);
				}
			}
		});
	},
	open: function() {
		this.update();
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
					var team = this.teams[prevMatch.winner.index];
					var pos = (prevMatch.parentNode.matches.indexOf(prevMatch) % 2) ? 1 : 0;
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
			team.getElement('span').setStyle('line-height', this.teamHeight);
		}, this);
		playerFontSize = this.teamHeight / $$('.tourn-team')[0].children[0].getElements('.tourn-player').length;
		if (this.options.scaleFonts) {
			$$('.tourn-player,.tourn-teamindex').each(function(player) {
				player.setStyle('font-size', playerFontSize / 1.5)
			})
		}
	},
	load: function(data) {
		var self = this;
		this.clear();
		var round = (data.rounds) ? data.rounds[0] : new Array(data.teams.length);
		var matches = [];
		var teams = [];
		this.teams = [];
		data.teams.each(function(team) {
			if (team.bye) {
				var team = Tourn.ByeTeam(this.options.byeTeam, team.index, {
					onClick: function(r,m,t) {
						this.fireEvent('teamClick', [this.teams[t]]);
					}.bind(this)
				});
			}
			else {
				var team = new Tourn.Team(team.players, team.index, {
					onClick: function(r,m,t) {
						this.setWinner(r,m,t);
						this.fireEvent('teamClick', [this.teams[t]]);
					}.bind(this)
				});
			}	
			
			this.teams[team.index] = team;
		}, this);
		
		var m = new Tourn.Match(matches.length);
		for (var t=0;t<this.teams.length;t+=2) {
			m.addTeam(this.teams[t], 0);
			m.addTeam(this.teams[t + 1], 1);
			matches.push(m);
			if (m.teams[0].isBye) m.setWinner(1);
			if (m.teams[1].isBye) m.setWinner(0);
			m = new Tourn.Match(matches.length);
		}
		
		var i = 2;
		while (this.teams.length > i) {
			i *= 2;
		}
		while (this.teams.length != i) {
			var index = (self.options.playerIndex) ? this.teams.length : -1;
			var match = Tourn.ByeMatch(this.options.byeTeam, index, {
				onClick: function(r,m,t) {
					this.fireEvent('teamClick', [this.teams[t]]);
				}.bind(this)
			});
			this.teams.push(match.teams[0]);
			this.teams.push(match.teams[1]);
			matches.push(match);
		}
		
		this.drawRounds();
		this.drawMatches(matches);
		if (data.rounds) {
			var lastRound = data.rounds.getLast();
			data.rounds.each(function(round, idx) {
				if (round != lastRound) {
					round.each(function(match, i) {
						if (match != -1) {
							self.rounds[idx].matches[i].setWinner(this.teams[match]);
						}
					}, this);
				}
			}, this);
		}
		
		//this.update();
		
		this.fireEvent('load');
	},
	save: function() {
		var obj = {};
		var rounds = [];
		var teams = [];
		this.teams.each(function(team) {
			if (team.toJSON) {
				teams.push(team.toJSON());
			}
			else {
				teams.push(Tourn.ByeTeam().toJSON());
			}
		});
		this.rounds.each(function(round) {
			var matches = [];
			round.matches.each(function(match) {
				var val = (match.winner) ? match.winner.index : -1;
				matches.push(val);
			})
			rounds.push(matches);
		});
		obj.rounds = rounds;
		obj.teams = teams;
		
		this.fireEvent('save', [obj]);
		
		return JSON.stringify(obj);
	},
	setWinner: function(r,m,w) {
		var winner = this.rounds[r].matches[m].setWinner(this.teams[w]);
		this.fireEvent('winner', [winner]);
		this.update();
	}
});