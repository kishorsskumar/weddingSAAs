import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Clock, CheckCircle, LogIn, LogOut, Calendar, Users, Image, ExternalLink, BarChart3, RefreshCw, Briefcase, UserX, Thermometer, Coffee } from "lucide-react";
import { format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkInTime: string | null;
  checkInLatitude: string | null;
  checkInLongitude: string | null;
  checkInAddress: string | null;
  checkInSelfieUrl: string | null;
  checkOutTime: string | null;
  checkOutLatitude: string | null;
  checkOutLongitude: string | null;
  checkOutAddress: string | null;
  totalHours: string | null;
  status: string;
  employee?: {
    id: string;
    name: string;
    designation: string;
    photoUrl: string | null;
  };
}

interface MonthlySummary {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  totalWorkingDays: number;
  daysPresent: number;
  daysAbsent: number;
  casualLeaves: number;
  sickLeaves: number;
  otherLeaves: number;
  totalLeaves: number;
  totalHoursWorked: string;
  avgHoursPerDay: string;
  lateCheckIns: number;
  sundaysInMonth: number;
  employeeName: string;
  designation: string;
}

export default function AttendanceAdminPage() {
  const [activeTab, setActiveTabState] = useState(() => {
    const saved = localStorage.getItem('attendance_admin_tab');
    if (saved && ['daily', 'monthly'].includes(saved)) return saved;
    return 'daily';
  });
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    localStorage.setItem('attendance_admin_tab', tab);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">Attendance Dashboard</h1>
          <p className="text-gray-600">Monitor employee attendance with location and photo verification</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border">
            <TabsTrigger value="daily" data-testid="tab-daily">
              <Calendar className="w-4 h-4 mr-2" />
              Daily View
            </TabsTrigger>
            <TabsTrigger value="monthly" data-testid="tab-monthly">
              <BarChart3 className="w-4 h-4 mr-2" />
              Monthly Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <DailyAttendanceView />
          </TabsContent>
          <TabsContent value="monthly">
            <MonthlyAttendanceSummary />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function DailyAttendanceView() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [showSelfieDialog, setShowSelfieDialog] = useState(false);

  const { data: attendanceRecords, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", { date: selectedDate }],
    queryFn: async () => {
      const response = await fetch(`/api/attendance?date=${selectedDate}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch attendance");
      return response.json();
    }
  });

  const { data: employees } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  const totalEmployees = employees?.filter(e => e.isActive)?.length || 0;
  const checkedInCount = attendanceRecords?.filter(r => r.status === "checked_in" || r.status === "checked_out")?.length || 0;
  const checkedOutCount = attendanceRecords?.filter(r => r.status === "checked_out")?.length || 0;
  const absentCount = totalEmployees - checkedInCount;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "checked_out":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case "checked_in":
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" /> Working</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  const openGoogleMaps = (lat: string, lng: string) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 justify-end">
        <Calendar className="w-5 h-5 text-gray-500" />
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-auto"
          data-testid="input-date"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-employees">{totalEmployees}</p>
                <p className="text-sm text-gray-500">Total Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <LogIn className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-checked-in">{checkedInCount}</p>
                <p className="text-sm text-gray-500">Checked In</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <LogOut className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-completed">{checkedOutCount}</p>
                <p className="text-sm text-gray-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Clock className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-absent">{absentCount}</p>
                <p className="text-sm text-gray-500">Not Checked In</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records - {format(new Date(selectedDate), "MMMM d, yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#4b7c29]" />
            </div>
          ) : attendanceRecords && attendanceRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead className="hidden md:table-cell">Check-in Location</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead className="hidden md:table-cell">Check-out Location</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Selfie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#4b7c29] text-white flex items-center justify-center text-sm font-bold">
                            {record.employee?.name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <div className="font-medium">{record.employee?.name || "Unknown"}</div>
                            <div className="text-xs text-gray-500">{record.employee?.designation}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.checkInTime ? (
                          <div className="flex items-center gap-1 text-sm">
                            <LogIn className="w-3 h-3 text-green-600" />
                            {format(new Date(record.checkInTime), "hh:mm a")}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {record.checkInLatitude && record.checkInLongitude ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-blue-600 p-0 h-auto"
                            onClick={() => openGoogleMaps(record.checkInLatitude!, record.checkInLongitude!)}
                          >
                            <MapPin className="w-3 h-3 mr-1" />
                            View Map
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {record.checkOutTime ? (
                          <div className="flex items-center gap-1 text-sm">
                            <LogOut className="w-3 h-3 text-red-600" />
                            {format(new Date(record.checkOutTime), "hh:mm a")}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {record.checkOutLatitude && record.checkOutLongitude ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-blue-600 p-0 h-auto"
                            onClick={() => openGoogleMaps(record.checkOutLatitude!, record.checkOutLongitude!)}
                          >
                            <MapPin className="w-3 h-3 mr-1" />
                            View Map
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {record.totalHours ? (
                          <span className="font-medium">{parseFloat(record.totalHours).toFixed(2)} hrs</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        {record.checkInSelfieUrl ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRecord(record);
                              setShowSelfieDialog(true);
                            }}
                          >
                            <Image className="w-4 h-4 text-[#4b7c29]" />
                          </Button>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No attendance records for this date
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSelfieDialog} onOpenChange={setShowSelfieDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Check-in Selfie - {selectedRecord?.employee?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRecord?.checkInSelfieUrl && (
              <img
                src={selectedRecord.checkInSelfieUrl}
                alt="Check-in selfie"
                className="w-full rounded-lg"
              />
            )}
            {selectedRecord?.checkInTime && (
              <div className="text-sm text-gray-600">
                <p><strong>Time:</strong> {format(new Date(selectedRecord.checkInTime), "hh:mm a, MMM d, yyyy")}</p>
                {selectedRecord.checkInAddress && (
                  <p className="mt-1"><strong>Location:</strong> {selectedRecord.checkInAddress}</p>
                )}
              </div>
            )}
            {selectedRecord?.checkInLatitude && selectedRecord?.checkInLongitude && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => openGoogleMaps(selectedRecord.checkInLatitude!, selectedRecord.checkInLongitude!)}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Open in Google Maps
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MonthlyAttendanceSummary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));

  const { data: summaries = [], isLoading } = useQuery<MonthlySummary[]>({
    queryKey: ["/api/attendance/monthly-summary", { month: selectedMonth, year: selectedYear }],
    queryFn: async () => {
      const response = await fetch(`/api/attendance/monthly-summary?month=${selectedMonth}&year=${selectedYear}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch monthly summary");
      return response.json();
    }
  });

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/attendance/calculate-monthly-summary", {
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/monthly-summary"] });
      toast({ title: "Summary Calculated", description: `Calculated attendance summary for ${data.count} employees.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to calculate monthly summary.", variant: "destructive" });
    },
  });

  const months = [
    { value: "1", label: "January" }, { value: "2", label: "February" },
    { value: "3", label: "March" }, { value: "4", label: "April" },
    { value: "5", label: "May" }, { value: "6", label: "June" },
    { value: "7", label: "July" }, { value: "8", label: "August" },
    { value: "9", label: "September" }, { value: "10", label: "October" },
    { value: "11", label: "November" }, { value: "12", label: "December" },
  ];

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
    years.push(String(y));
  }

  const totals = summaries.reduce((acc, s) => ({
    present: acc.present + s.daysPresent,
    absent: acc.absent + s.daysAbsent,
    casual: acc.casual + s.casualLeaves,
    sick: acc.sick + s.sickLeaves,
    other: acc.other + s.otherLeaves,
    totalLeaves: acc.totalLeaves + s.totalLeaves,
    hours: acc.hours + parseFloat(s.totalHoursWorked || '0'),
  }), { present: 0, absent: 0, casual: 0, sick: 0, other: 0, totalLeaves: 0, hours: 0 });

  const selectedMonthLabel = months.find(m => m.value === selectedMonth)?.label || '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => calculateMutation.mutate()}
          disabled={calculateMutation.isPending}
          className="bg-[#4b7c29] hover:bg-[#3d6621]"
          data-testid="btn-calculate-summary"
        >
          {calculateMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Calculate Summary
        </Button>
      </div>

      {summaries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-bold" data-testid="text-summary-employees">{summaries.length}</p>
                  <p className="text-xs text-gray-500">Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg">
                  <Briefcase className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-lg font-bold" data-testid="text-summary-working-days">{summaries[0]?.totalWorkingDays || 0}</p>
                  <p className="text-xs text-gray-500">Working Days</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-lg">
                  <Coffee className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-lg font-bold" data-testid="text-summary-casual">{totals.casual}</p>
                  <p className="text-xs text-gray-500">Casual Leaves</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-100 rounded-lg">
                  <Thermometer className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-lg font-bold" data-testid="text-summary-sick">{totals.sick}</p>
                  <p className="text-xs text-gray-500">Sick Leaves</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 rounded-lg">
                  <UserX className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-lg font-bold" data-testid="text-summary-absent">{totals.absent}</p>
                  <p className="text-xs text-gray-500">Total Absent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 rounded-lg">
                  <Clock className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-lg font-bold" data-testid="text-summary-hours">{totals.hours.toFixed(0)}</p>
                  <p className="text-xs text-gray-500">Total Hours</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Employee Attendance Summary - {selectedMonthLabel} {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#4b7c29]" />
            </div>
          ) : summaries.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-center">Working Days</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Casual Leave</TableHead>
                    <TableHead className="text-center">Sick Leave</TableHead>
                    <TableHead className="text-center hidden lg:table-cell">Other Leave</TableHead>
                    <TableHead className="text-center">Total Leave</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center hidden lg:table-cell">Hours Worked</TableHead>
                    <TableHead className="text-center hidden lg:table-cell">Avg Hrs/Day</TableHead>
                    <TableHead className="text-center">Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((summary) => {
                    const attendancePercent = summary.totalWorkingDays > 0
                      ? ((summary.daysPresent / summary.totalWorkingDays) * 100).toFixed(1)
                      : "0.0";
                    const pct = parseFloat(attendancePercent);
                    return (
                      <TableRow key={summary.id} data-testid={`row-summary-${summary.employeeId}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#4b7c29] text-white flex items-center justify-center text-sm font-bold shrink-0">
                              {summary.employeeName?.charAt(0) || "?"}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{summary.employeeName}</div>
                              <div className="text-xs text-gray-500">{summary.designation}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">{summary.totalWorkingDays}</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-green-100 text-green-800">{summary.daysPresent}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {summary.casualLeaves > 0 ? (
                            <Badge className="bg-orange-100 text-orange-800">{summary.casualLeaves}</Badge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {summary.sickLeaves > 0 ? (
                            <Badge className="bg-red-100 text-red-800">{summary.sickLeaves}</Badge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center hidden lg:table-cell">
                          {summary.otherLeaves > 0 ? (
                            <Badge className="bg-purple-100 text-purple-800">{summary.otherLeaves}</Badge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {summary.totalLeaves > 0 ? (
                            <Badge className="bg-amber-100 text-amber-800 font-semibold">{summary.totalLeaves}</Badge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {summary.daysAbsent > 0 ? (
                            <Badge className="bg-gray-200 text-gray-800">{summary.daysAbsent}</Badge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center hidden lg:table-cell font-medium">
                          {parseFloat(summary.totalHoursWorked || '0').toFixed(1)}
                        </TableCell>
                        <TableCell className="text-center hidden lg:table-cell">
                          {parseFloat(summary.avgHoursPerDay || '0').toFixed(1)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={
                            pct >= 90 ? "bg-green-100 text-green-800" :
                            pct >= 75 ? "bg-yellow-100 text-yellow-800" :
                            "bg-red-100 text-red-800"
                          }>
                            {attendancePercent}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="font-medium">No summary data available</p>
              <p className="text-sm mt-1">Click "Calculate Summary" to generate the attendance summary for {selectedMonthLabel} {selectedYear}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
