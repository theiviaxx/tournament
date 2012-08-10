import random
import urlparse

from django.db.models import Q

from lib.common import MainView, JsonResponse, Result
from tournament.models import Tournament, Match
from ladder.models import Team


class TournamentView(MainView):
    def __init__(self):
        super(TournamentView, self).__init__(Tournament)
    
    def index(self, request):
        self._processRequest(request)

        tournaments = [t.json('match') for t in Tournament.objects.filter(state=Tournament.Open, public=True)]
        self._getContext(tournaments=tournaments)

        if self.GET.get('json', False):
            result = Result()
            result.isSuccess = True
            result.values = tournaments
            result.value = result.values[0] if len(result.values) > 0 else None
            return JsonResponse(result)

        return self.render()
    
    def init(self, request, obj_id):
        t = Tournament.objects.get(pk=obj_id)
        t.init()

        result = Result()
        result.isSuccess = True
        result.message = "All matches have been generated"

        return JsonResponse(result)
    
    def post(self, request, *args, **kwargs):
        result = Result()
        if kwargs.get('obj_id', None):
            self._processRequest(request, kwargs['obj_id'])

            if self.POST.get('start'):
                self.object.state = Tournament.Started
                self.object.save()

                result.isSuccess = True

                return JsonResponse(result)
        else:
            self.object = Tournament()
        
        for k,v in request.POST.iteritems():
            if hasattr(self.object, k):
                try:
                    v = int(v)
                except ValueError:
                    pass
                if v.lower() == 'true':
                    v = True
                elif v.lower() == 'false':
                    v = False
                setattr(self.object, k, v)
            else:
                result.isError = True
                result.message = "Invalid property: %s" % k
                break
        
        if not result.isError:
            self.object.save()
            result.isSuccess = True
        
        return JsonResponse(result)
    
    def put(self, request, obj_id):
        result = Result()
        tourn = Tournament.objects.get(pk=obj_id)

        if tourn.state != Tournament.Open:
            result.isError = True
            result.message = "This tournament is not open"
            return JsonResponse(result)
        
        teamID = self.PUT.get('team', None)
        if teamID:
            team = Team.objects.get(pk=teamID)

            if team.members.all().count() != tourn.team_size:
                result.isError = True
                result.message = "%s does not have the correct number of players (%i) to join this tournament" % (team.name, tourn.team_size)
                return JsonResponse(result)

            hasJoined = tourn.matches.filter(Q(red=team) | Q(blu=team), round=1)
            if len(hasJoined):
                result.message = '%s has already joined this tournament' % team.name
                result.isError = True
                return JsonResponse(result)

            matches = tourn.matches.filter(red__isnull=True, round=1)
            if not matches:
                matches = tourn.matches.filter(blu__isnull=True, round=1)
            match = random.choice(matches)

            if match.red:
                match.blu = team
            else:
                match.red = team
            
            tourn.teams.add(team)
            match.save()
            
            result.isSuccess = True
        else:
            result.isError = True
            result.message = "No team provided"

        return JsonResponse(result)


class MatchView(MainView):
    def __init__(self):
        super(MatchView, self).__init__(Match)
    
    def index(self, request):
        self._processRequest(request)
        result = Result()

        qs = Q()
        for n in self.user.teams.all():
            qs |= Q(red=n)
            qs |= Q(blu=n)

        matches = Match.objects.filter(qs, state=Match.Open)

        obj = [m.json() for m in matches]

        result.isSuccess = True
        result.setValue(obj)

        return JsonResponse(result)
    
    def get(self, request, obj_id):
        result = Result()
        obj = Match.objects.get(pk=obj_id)
        result.isSuccess = True
        result.setValue(obj.json())

        return JsonResponse(result)
    
    def post(self, request, obj_id):
        result = Result()
        matchResult = self.POST.get('result', False)
        if matchResult:
            obj = Match.objects.get(pk=obj_id)
            teams = request.user.teams.all()

            if obj.red not in teams and obj.blu not in teams:
                result.isError = True
                result.message = "You are not a member of a team in this match"
            else:
                winner = Team.objects.get(pk=matchResult)
                matchTeams = [obj.red, obj.blu]
                if winner not in matchTeams:
                    result.isError = True
                    result.message = "Team ID provided is not in this match"

                    return JsonResponse(result)
                
                if obj.state != Match.Open:
                    result.isError = True
                    result.message = "Match is not open"

                    return JsonResponse(result)
                
                newMatch = obj.promote(winner)
                if newMatch.state == Match.Open:
                    # mail new teams
                    pass

                result.isSuccess = True
                result.message = "Match result recorded: %s %s %s" % (obj.red.name, '>' if winner == obj.red else '<', obj.blu.name)
        else:
            result.isError = True
            result.message = "No winning team ID provided"

        return JsonResponse(result)



tournament = TournamentView()
match = MatchView()