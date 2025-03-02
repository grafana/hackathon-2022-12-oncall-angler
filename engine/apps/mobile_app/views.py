from push_notifications.api.rest_framework import APNSDeviceAuthorizedViewSet as BaseAPNSDeviceAuthorizedViewSet
from push_notifications.api.rest_framework import GCMDeviceAuthorizedViewSet, GCMDeviceSerializer
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.serializers import HiddenField
from rest_framework.views import APIView

from apps.mobile_app.auth import MobileAppAuthTokenAuthentication, MobileAppVerificationTokenAuthentication
from apps.mobile_app.models import MobileAppAuthToken


class APNSDeviceAuthorizedViewSet(BaseAPNSDeviceAuthorizedViewSet):
    authentication_classes = (MobileAppAuthTokenAuthentication,)


class FCMDeviceAuthorizedViewSet(GCMDeviceAuthorizedViewSet):
    class FCMDeviceSerializer(GCMDeviceSerializer):
        """
        GCMDevice has cloud_message_type equal to "GCM" by default, in this serializer cloud_message_type is always set
        to "FCM" no matter what was provided in the request.
        """

        cloud_message_type = HiddenField(default="FCM")

    authentication_classes = (MobileAppAuthTokenAuthentication,)
    serializer_class = FCMDeviceSerializer


class MobileAppAuthTokenAPIView(APIView):
    authentication_classes = (MobileAppVerificationTokenAuthentication,)

    def get(self, request):
        try:
            token = MobileAppAuthToken.objects.get(user=self.request.user)
        except MobileAppAuthToken.DoesNotExist:
            raise NotFound

        response = {
            "token_id": token.id,
            "user_id": token.user_id,
            "organization_id": token.organization_id,
            "created_at": token.created_at,
            "revoked_at": token.revoked_at,
        }
        return Response(response, status=status.HTTP_200_OK)

    def post(self, request):
        # If token already exists revoke it
        try:
            token = MobileAppAuthToken.objects.get(user=self.request.user)
            token.delete()
        except MobileAppAuthToken.DoesNotExist:
            pass

        instance, token = MobileAppAuthToken.create_auth_token(self.request.user, self.request.user.organization)
        data = {"id": instance.pk, "token": token, "created_at": instance.created_at}
        return Response(data, status=status.HTTP_201_CREATED)

    def delete(self, request):
        try:
            token = MobileAppAuthToken.objects.get(user=self.request.user)
            token.delete()
        except MobileAppAuthToken.DoesNotExist:
            raise NotFound

        return Response(status=status.HTTP_204_NO_CONTENT)
