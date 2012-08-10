import cmath

from django.db import models
from django.contrib.auth.models import User

from ladder.models import Team, Game

from lib.common import userToJson

class Tournament(models.Model):
    Open = 0
    Started = 1
    Ended = 2

    name = models.CharField(max_length=128)
    owner = models.ForeignKey(User, related_name='tournament_owner')
    teams = models.ManyToManyField(Team, blank=True, null=True)
    start_date = models.DateTimeField(blank=True, null=True)
    end_date = models.DateTimeField(blank=True, null=True)
    created = models.DateTimeField(auto_now=True, blank=True, null=True)
    public = models.BooleanField(default=True)
    state = models.SmallIntegerField(default=0)
    count = models.SmallIntegerField()
    team_size = models.SmallIntegerField()
    winner = models.ForeignKey(Team, null=True, blank=True, related_name='winner')
    private_key = models.CharField(max_length=128, default='tournament')
    auto_start = models.BooleanField(default=True)

    def __unicode__(self):
        return self.name
    
    def json(self, context=None, **kwargs):
        obj = {
            'id': self.id,
            'name': self.name,
            'owner': userToJson(self.owner),
            'start': self.start_date.isoformat() if self.start_date else None,
            'end': self.end_date.isoformat() if self.end_date else None,
            'created':  self.created.isoformat(),
            'public': bool(self.public),
            'state': self.state,
            'count': self.count,
            'team_size': self.team_size,
            'teams': [team.json('game') for team in self.teams.all()],
            'object': self.serializeState(),
        }

        if context != 'match':
            obj['matches'] = [match.json('tournament') for match in self.matches.all()]

        return obj
    
    def start(self):
        """
        Emails games to players
        Sets status to started
        """
        pass
    
    def end(self):
        """
        Sets status to ended
        """
        pass
    
    def init(self):
        if self.matches.all().count() == 0:
            roundCount = int(cmath.log(self.count, 2).real)# + 1
            for i in xrange(roundCount):
                round = i + 1
                count = (self.count / 2) / round
                for j in xrange(count):
                    m = Match()
                    m.index = j
                    m.round = round
                    m.tournament = self
                    m.save()
    
    def serializeState(self):
        """ {"players":[{"name":"Team 6"}],"bye":false,"index":5} """
        teams = []
        rounds = []
        teamMap = {}
        i = 0

        for n in self.matches.all().order_by('round'):
            if n.round == 1:
                teamMap[i] = n.red
                i += 1
                teamMap[i] = n.blu
                i += 1
            
            try:
                round = rounds[n.round - 1]
            except IndexError:
                rounds.append([])
                round = rounds[n.round - 1]
            if n.result is not None:
                result = n.red if n.result == 0 else n.blu
                result = [k for k, v in teamMap.iteritems() if v == result][0]
            else:
                result = -1
            round.append(result)
        
        for i,t in teamMap.iteritems():
            team = {
                'players': [],
                'bye': False,
                'index': i,
            }
            if t:
                team['players'] = map(lambda u: {'name': u.username}, t.members.all())
            else:
                team['bye'] = True
            teams.append(team)
        
        obj = {
            'rounds': rounds,
            'teams': teams,
        }

        return obj


class Match(models.Model):
    Init = 0
    Open = 1
    Closed = 2
    Pending = 3

    tournament = models.ForeignKey(Tournament, related_name='matches')
    round = models.SmallIntegerField()
    index = models.SmallIntegerField()
    red = models.ForeignKey(Team, null=True, blank=True, related_name='match_red')
    blu = models.ForeignKey(Team, null=True, blank=True, related_name='match_blu')
    result = models.SmallIntegerField(null=True, blank=True)
    state = models.SmallIntegerField(default=0)

    def json(self, context=None, **kwargs):
        obj = {
            'id': self.id,
            'tournament': self.tournament.json('match'),
            'round': self.round,
            'index': self.index,
            'state': self.state,
            'red': self.red.json('game') if self.red else None,
            'blu': self.blu.json('game') if self.blu else None,
        }

        return obj
    
    def next(self):
        index = 2 / (self.index - self.index % 2) if self.index > 1 else 0
        round = self.round + 1
        match = self.tournament.matches.get(round=round, index=index)

        return match
    
    def previous(self):
        index = 2 * (self.index + self.index % 2)
        round = self.round - 1
        teams = [self.red, self.blu]
        match = self.tournament.matches.get(Q(red__in=teams) | Q(blu__in=teams), round=round, index=index)

        return match
    
    def promote(self, winner):
        match = self.next()
        if self.index % 2 == 1:
            match.blu = winner
        else:
            match.red = winner
        
        if self.tournament.state == Tournament.Started and match.red and match.blu:
            match.state = Match.Open
        
        self.state = Match.Closed
        self.result = int(winner == self.blu)
        
        self.save()
        match.save()

        return match