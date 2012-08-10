from django.contrib import admin
from models import *

class TournamentAdmin(admin.ModelAdmin):
	list_display = ('name', 'owner', 'public', 'state', 'count', 'team_size')


class MatchAdmin(admin.ModelAdmin):
	list_display = ('tournament', 'round', 'index', 'red', 'blu', 'result', 'state')

admin.site.register(Tournament, TournamentAdmin)
admin.site.register(Match, MatchAdmin)