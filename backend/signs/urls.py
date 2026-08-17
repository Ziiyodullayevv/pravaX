from django.urls import path

from .views import SignDetailView, SignListView, SignSectionListView

urlpatterns = [
    path('sections/',                       SignSectionListView.as_view(), name='sign-section-list'),
    path('sections/<int:section_id>/signs/', SignListView.as_view(),        name='sign-list'),
    path('<int:pk>/',                        SignDetailView.as_view(),       name='sign-detail'),
]
