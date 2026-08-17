from django.urls import path

from .views import (
    AbandonSessionView,
    CategoryListView,
    ExamSessionDetailView,
    ExamSessionListCreateView,
    MistakeListView,
    QuestionDetailView,
    QuestionListView,
    SavedQuestionDeleteView,
    SavedQuestionView,
    StartMarathonView,
    StartMixedView,
    StartPracticeView,
    StartTestView,
    SubmitSessionView,
)

urlpatterns = [
    path('categories/', CategoryListView.as_view(), name='category-list'),
    path('questions/', QuestionListView.as_view(), name='question-list'),
    path('questions/<int:pk>/', QuestionDetailView.as_view(), name='question-detail'),

    path('sessions/',                    ExamSessionListCreateView.as_view(), name='session-list-create'),
    path('sessions/<int:pk>/',           ExamSessionDetailView.as_view(),     name='session-detail'),
    path('sessions/<int:pk>/submit/',    SubmitSessionView.as_view(),         name='session-submit'),
    path('sessions/<int:pk>/abandon/',   AbandonSessionView.as_view(),        name='session-abandon'),

    path('test/',     StartTestView.as_view(),     name='exam-start'),
    path('mixed/',    StartMixedView.as_view(),    name='mixed-start'),
    path('marathon/', StartMarathonView.as_view(), name='marathon-start'),
    path('practice/', StartPracticeView.as_view(), name='practice-start'),

    path('saved/',                   SavedQuestionView.as_view(),       name='saved-list'),
    path('saved/<int:question_id>/', SavedQuestionDeleteView.as_view(), name='saved-delete'),

    path('mistakes/', MistakeListView.as_view(), name='mistake-list'),
]
