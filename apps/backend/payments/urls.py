from django.urls import path

from .views import MyPaymentsView, PaymentInitiateView, PaymentStatusView

urlpatterns = [
    path('initiate/',  PaymentInitiateView.as_view(), name='payment-initiate'),
    path('my/',        MyPaymentsView.as_view(),      name='payment-my'),
    path('<int:pk>/',  PaymentStatusView.as_view(),   name='payment-status'),
]
