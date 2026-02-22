import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Camera, MapPin, Clock, CheckCircle, LogIn, LogOut, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface AttendanceStatus {
  employee: any;
  todayAttendance: any;
  status: string;
}

export default function AttendancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { data: statusData, isLoading: statusLoading } = useQuery<AttendanceStatus>({
    queryKey: ["/api/attendance/my-status"],
  });

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: 640, height: 480 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description: "Could not access your camera. Please grant permission.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.8);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  }, [stopCamera]);

  const getLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      const { latitude, longitude } = position.coords;
      setLocation({ latitude, longitude });
      
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await response.json();
        if (data.display_name) {
          setLocation(prev => prev ? { ...prev, address: data.display_name } : null);
        }
      } catch (e) {
        console.log("Could not get address");
      }
    } catch (error: any) {
      console.error("Error getting location:", error);
      setLocationError(error.message || "Could not get your location");
    } finally {
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    getLocation();
    return () => {
      stopCamera();
    };
  }, [getLocation, stopCamera]);

  const uploadSelfieMutation = useMutation({
    mutationFn: async (imageData: string) => {
      const blob = await fetch(imageData).then(r => r.blob());
      const formData = new FormData();
      formData.append("selfie", blob, "selfie.jpg");
      
      const response = await fetch("/api/attendance/upload-selfie", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload selfie");
      }
      
      return response.json();
    }
  });

  const checkInMutation = useMutation({
    mutationFn: async (data: { latitude?: number; longitude?: number; address?: string; selfieUrl: string }) => {
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to check in");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/my-status"] });
      toast({
        title: "Checked In",
        description: "You have successfully checked in for today.",
      });
      setCapturedImage(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Check-in Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async (data: { latitude?: number; longitude?: number; address?: string }) => {
      const response = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to check out");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/my-status"] });
      toast({
        title: "Checked Out",
        description: "You have successfully checked out. Have a great day!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Check-out Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleCheckIn = async () => {
    if (!capturedImage) {
      toast({
        title: "Photo Required",
        description: "Please take a selfie before checking in.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const uploadResult = await uploadSelfieMutation.mutateAsync(capturedImage);
      await checkInMutation.mutateAsync({
        latitude: location?.latitude,
        longitude: location?.longitude,
        address: location?.address,
        selfieUrl: uploadResult.selfieUrl
      });
    } catch (error) {
      console.error("Check-in error:", error);
    }
  };

  const handleCheckOut = async () => {
    await checkOutMutation.mutateAsync({
      latitude: location?.latitude,
      longitude: location?.longitude,
      address: location?.address
    });
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#4b7c29]" />
      </div>
    );
  }

  const isCheckedIn = statusData?.status === "checked_in";
  const isCheckedOut = statusData?.status === "checked_out";
  const notCheckedIn = statusData?.status === "not_checked_in";

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Daily Attendance</h1>
          <p className="text-gray-600 mt-1">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        {statusData?.employee && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-[#4b7c29] text-white flex items-center justify-center font-bold">
                  {statusData.employee.name?.charAt(0) || "E"}
                </div>
                <div>
                  <div>{statusData.employee.name}</div>
                  <div className="text-sm text-gray-500 font-normal">{statusData.employee.designation}</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Status:</span>
                {isCheckedOut && (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" /> Checked Out
                  </Badge>
                )}
                {isCheckedIn && (
                  <Badge className="bg-blue-100 text-blue-800">
                    <Clock className="w-3 h-3 mr-1" /> Checked In
                  </Badge>
                )}
                {notCheckedIn && (
                  <Badge className="bg-gray-100 text-gray-800">
                    Not Checked In
                  </Badge>
                )}
              </div>
              
              {statusData?.todayAttendance && (
                <div className="mt-4 space-y-2 text-sm">
                  {statusData.todayAttendance.checkInTime && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <LogIn className="w-4 h-4 text-green-600" />
                      Check-in: {format(new Date(statusData.todayAttendance.checkInTime), "hh:mm a")}
                      {statusData.todayAttendance.checkInAddress && (
                        <span className="text-xs text-gray-400 truncate max-w-[200px]">
                          @ {statusData.todayAttendance.checkInAddress.split(',')[0]}
                        </span>
                      )}
                    </div>
                  )}
                  {statusData.todayAttendance.checkOutTime && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <LogOut className="w-4 h-4 text-red-600" />
                      Check-out: {format(new Date(statusData.todayAttendance.checkOutTime), "hh:mm a")}
                    </div>
                  )}
                  {statusData.todayAttendance.totalHours && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Total Hours: {parseFloat(statusData.todayAttendance.totalHours).toFixed(2)} hrs
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#4b7c29]" />
              Your Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            {locationLoading && (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Getting your location...
              </div>
            )}
            {locationError && (
              <div className="text-red-600 text-sm">
                {locationError}
                <Button variant="link" size="sm" onClick={getLocation} className="ml-2">
                  <RefreshCw className="w-3 h-3 mr-1" /> Retry
                </Button>
              </div>
            )}
            {location && !locationLoading && (
              <div className="space-y-1">
                <div className="text-sm text-gray-600">
                  Lat: {location.latitude.toFixed(6)}, Long: {location.longitude.toFixed(6)}
                </div>
                {location.address && (
                  <div className="text-sm text-gray-500 line-clamp-2">
                    {location.address}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {notCheckedIn && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#4b7c29]" />
                Take Selfie for Check-in
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!capturedImage && (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {!cameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                        <Button onClick={startCamera} className="bg-[#4b7c29] hover:bg-[#3d6622]">
                          <Camera className="w-4 h-4 mr-2" /> Start Camera
                        </Button>
                      </div>
                    )}
                  </div>
                  {cameraActive && (
                    <Button onClick={capturePhoto} className="w-full bg-[#4b7c29] hover:bg-[#3d6622]">
                      <Camera className="w-4 h-4 mr-2" /> Capture Photo
                    </Button>
                  )}
                </>
              )}
              
              {capturedImage && (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <img src={capturedImage} alt="Captured selfie" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setCapturedImage(null);
                        startCamera();
                      }}
                      className="flex-1"
                    >
                      Retake
                    </Button>
                    <Button 
                      onClick={handleCheckIn}
                      disabled={uploadSelfieMutation.isPending || checkInMutation.isPending || !location}
                      className="flex-1 bg-[#4b7c29] hover:bg-[#3d6622]"
                    >
                      {(uploadSelfieMutation.isPending || checkInMutation.isPending) ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking In...</>
                      ) : (
                        <><LogIn className="w-4 h-4 mr-2" /> Check In</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              
              <canvas ref={canvasRef} className="hidden" />
            </CardContent>
          </Card>
        )}

        {isCheckedIn && (
          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={handleCheckOut}
                disabled={checkOutMutation.isPending || locationLoading}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                size="lg"
              >
                {checkOutMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking Out...</>
                ) : (
                  <><LogOut className="w-4 h-4 mr-2" /> Check Out</>
                )}
              </Button>
              <p className="text-center text-sm text-gray-500 mt-2">
                Your current location will be recorded
              </p>
            </CardContent>
          </Card>
        )}

        {isCheckedOut && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
              <p className="text-green-800 font-medium">You're done for today!</p>
              <p className="text-green-600 text-sm">
                Total working hours: {statusData?.todayAttendance?.totalHours || 0} hrs
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
