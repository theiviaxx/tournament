from django.conf.urls.defaults import *

from views import tournament, match

urlpatterns = patterns('',
    # Tournament views
    (r'^$', tournament.index),
    (r'^(?P<obj_id>\d+)$', tournament.view),
    (r'^(?P<obj_id>\d+)/init$', tournament.init),
    # Match views
    (r'^match$', match.index),
    (r'^match/(?P<obj_id>\d+)$', match.view),
)
