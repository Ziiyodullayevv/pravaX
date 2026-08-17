from django.urls import path

from .views import (
    AcademyContestListCreateView,
    AcademyContestRankingView,
    AcademyDashboardView,
    AcademyIncomeView,
    AcademyJoinView,
    AcademyLoginView,
    AcademyMeView,
    AcademySearchView,
    AcademyStudentsView,
    ContestDetailView,
    ContestJoinView,
    ContestListView,
    ContestQuestionsView,
    ContestRankingView,
    ContestSubmitView,
    MyContestsView,
)

urlpatterns = [
    # ─── Public contest endpoints (User auth) ─────────────────────────────────
    path('',                        ContestListView.as_view(),      name='contest-list'),
    path('my/',                     MyContestsView.as_view(),       name='contest-my'),

    # ─── Academy student-facing (User auth) ───────────────────────────────────
    path('academy/',                AcademySearchView.as_view(),    name='academy-search'),
    path('academy/join/',           AcademyJoinView.as_view(),      name='academy-join'),

    # ─── Academy admin (AcademyJWT auth) ──────────────────────────────────────
    path('academy/login/',                     AcademyLoginView.as_view(),             name='academy-login'),
    path('academy/me/',                        AcademyMeView.as_view(),                name='academy-me'),
    path('academy/dashboard/',                 AcademyDashboardView.as_view(),         name='academy-dashboard'),
    path('academy/students/',                  AcademyStudentsView.as_view(),          name='academy-students'),
    path('academy/income/',                    AcademyIncomeView.as_view(),            name='academy-income'),
    path('academy/contests/',                  AcademyContestListCreateView.as_view(), name='academy-contest-list'),
    path('academy/contests/<int:pk>/ranking/', AcademyContestRankingView.as_view(),    name='academy-contest-ranking'),

    # ─── Single contest (User auth) ───────────────────────────────────────────
    path('<int:pk>/',               ContestDetailView.as_view(),    name='contest-detail'),
    path('<int:pk>/join/',          ContestJoinView.as_view(),      name='contest-join'),
    path('<int:pk>/questions/',     ContestQuestionsView.as_view(), name='contest-questions'),
    path('<int:pk>/submit/',        ContestSubmitView.as_view(),    name='contest-submit'),
    path('<int:pk>/ranking/',       ContestRankingView.as_view(),   name='contest-ranking'),
]
