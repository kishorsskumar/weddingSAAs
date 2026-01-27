import { useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, Calendar, MapPin, Heart } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface PublicForm {
  template: {
    id: string;
    name: string;
    welcomeMessage?: string | null;
    confirmationMessage?: string | null;
    requireEmail: boolean;
    requirePhone: boolean;
  };
  fields: {
    id: string;
    fieldKey: string;
    fieldType: string;
    label: string;
    placeholder?: string | null;
    required: boolean;
    options?: { value: string; label: string }[] | null;
  }[];
  event?: {
    name: string;
    date: string;
    venue?: string | null;
  } | null;
}

export default function PublicRsvpForm() {
  const { slug: formId } = useParams<{ slug: string }>();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [checkboxData, setCheckboxData] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const { data: form, isLoading, error } = useQuery<PublicForm>({
    queryKey: ['/api/public/rsvp', formId],
    queryFn: async () => {
      const res = await fetch(`/api/public/rsvp/${formId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Form not found');
        throw new Error('Failed to load form');
      }
      return res.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/public/rsvp/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to submit');
      return res.json();
    },
    onSuccess: (data) => {
      setSubmitted(true);
      setSuccessMessage(data.message || 'Thank you for your RSVP!');
    },
  });

  const handleInputChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    setCheckboxData(prev => {
      const current = prev[fieldId] || [];
      if (checked) {
        return { ...prev, [fieldId]: [...current, option] };
      }
      return { ...prev, [fieldId]: current.filter(o => o !== option) };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const guestName = formData.guestName || '';
    const guestEmail = formData.guestEmail || '';
    const guestPhone = formData.guestPhone || '';
    const attending = formData.attending || 'pending';
    const partySize = parseInt(formData.partySize || '1', 10);

    const responses: Record<string, unknown> = {};
    form?.fields.forEach(field => {
      if (field.fieldType === 'multiselect') {
        responses[field.fieldKey] = checkboxData[field.id] || [];
      } else {
        responses[field.fieldKey] = formData[field.id] || '';
      }
    });

    submitMutation.mutate({
      guestName,
      guestEmail,
      guestPhone,
      attending,
      partySize,
      responses,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-rose-50 to-white" data-testid="loading-state">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-rose-50 to-white" data-testid="error-state">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Form Not Found</h2>
            <p className="text-muted-foreground">This RSVP form doesn't exist or is no longer available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-rose-50 to-white p-4" data-testid="success-state">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2" data-testid="success-title">Thank You!</h2>
            <p className="text-muted-foreground">{successMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = form.template.primaryColor || 'hsl(350, 80%, 50%)';
  const bgColor = form.template.backgroundColor || 'hsl(350, 100%, 98%)';

  return (
    <div
      className="min-h-screen py-8 px-4"
      style={{ background: `linear-gradient(180deg, ${bgColor} 0%, white 100%)` }}
    >
      <div className="max-w-lg mx-auto">
        {form.template.headerImage && (
          <div className="mb-6 rounded-xl overflow-hidden shadow-lg" data-testid="header-image">
            <img src={form.template.headerImage} alt="" className="w-full h-48 object-cover" />
          </div>
        )}

        <Card className="shadow-xl" data-testid="rsvp-form-card">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-2">
              <Heart className="h-6 w-6" style={{ color: primaryColor }} />
            </div>
            <CardTitle className="text-2xl" data-testid="form-title">{form.template.name}</CardTitle>
            {form.event && (
              <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground mt-2">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(form.event.date), 'EEEE, MMMM d, yyyy')}</span>
                </div>
                {form.event.venue && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{form.event.venue}</span>
                  </div>
                )}
              </div>
            )}
            {form.template.welcomeMessage && (
              <CardDescription className="mt-3">{form.template.welcomeMessage}</CardDescription>
            )}
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 pt-4">
              <div>
                <Label htmlFor="guestName">Your Name *</Label>
                <Input
                  id="guestName"
                  required
                  value={formData.guestName || ''}
                  onChange={(e) => handleInputChange('guestName', e.target.value)}
                  placeholder="Full name"
                  data-testid="input-name"
                />
              </div>

              <div>
                <Label htmlFor="guestEmail">Email{form.template.requireEmail ? ' *' : ''}</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  required={form.template.requireEmail}
                  value={formData.guestEmail || ''}
                  onChange={(e) => handleInputChange('guestEmail', e.target.value)}
                  placeholder="your@email.com"
                  data-testid="input-email"
                />
              </div>

              <div>
                <Label htmlFor="guestPhone">Phone{form.template.requirePhone ? ' *' : ''}</Label>
                <Input
                  id="guestPhone"
                  type="tel"
                  required={form.template.requirePhone}
                  value={formData.guestPhone || ''}
                  onChange={(e) => handleInputChange('guestPhone', e.target.value)}
                  placeholder="+91 9876543210"
                  data-testid="input-phone"
                />
              </div>

              <div>
                <Label>Will you be attending? *</Label>
                <RadioGroup
                  value={formData.attending || ''}
                  onValueChange={(v) => handleInputChange('attending', v)}
                  className="flex flex-wrap gap-4 mt-2"
                  required
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="attending-yes" data-testid="radio-yes" />
                    <Label htmlFor="attending-yes" className="font-normal cursor-pointer">Yes, I'll be there!</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="attending-no" data-testid="radio-no" />
                    <Label htmlFor="attending-no" className="font-normal cursor-pointer">No, can't make it</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="maybe" id="attending-maybe" data-testid="radio-maybe" />
                    <Label htmlFor="attending-maybe" className="font-normal cursor-pointer">Not sure yet</Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.attending === 'yes' && (
                <div>
                  <Label htmlFor="partySize">Number of Guests (including you)</Label>
                  <Select
                    value={formData.partySize || '1'}
                    onValueChange={(v) => handleInputChange('partySize', v)}
                  >
                    <SelectTrigger data-testid="select-guest-count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'guest' : 'guests'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.fields.map((field, index) => (
                <div key={field.id} data-testid={`custom-field-${index}`}>
                  <Label htmlFor={field.id}>
                    {field.label} {field.required && '*'}
                  </Label>
                  {field.helpText && (
                    <p className="text-xs text-muted-foreground mb-1">{field.helpText}</p>
                  )}

                  {field.fieldType === 'text' && (
                    <Input
                      id={field.id}
                      required={field.required}
                      placeholder={field.placeholder || ''}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                    />
                  )}

                  {field.fieldType === 'email' && (
                    <Input
                      id={field.id}
                      type="email"
                      required={field.required}
                      placeholder={field.placeholder || ''}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                    />
                  )}

                  {field.fieldType === 'phone' && (
                    <Input
                      id={field.id}
                      type="tel"
                      required={field.required}
                      placeholder={field.placeholder || ''}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                    />
                  )}

                  {field.fieldType === 'number' && (
                    <Input
                      id={field.id}
                      type="number"
                      required={field.required}
                      placeholder={field.placeholder || ''}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                    />
                  )}

                  {field.fieldType === 'textarea' && (
                    <Textarea
                      id={field.id}
                      required={field.required}
                      placeholder={field.placeholder || ''}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                    />
                  )}

                  {field.fieldType === 'select' && field.options && (
                    <Select
                      value={formData[field.id] || ''}
                      onValueChange={(v) => handleInputChange(field.id, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={field.placeholder || 'Select...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {field.fieldType === 'radio' && field.options && (
                    <RadioGroup
                      value={formData[field.id] || ''}
                      onValueChange={(v) => handleInputChange(field.id, v)}
                      className="flex flex-wrap gap-4 mt-2"
                    >
                      {field.options.map(opt => (
                        <div key={opt} className="flex items-center space-x-2">
                          <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                          <Label htmlFor={`${field.id}-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {field.fieldType === 'checkbox' && field.options && (
                    <div className="flex flex-wrap gap-4 mt-2">
                      {field.options.map(opt => (
                        <div key={opt} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${field.id}-${opt}`}
                            checked={(checkboxData[field.id] || []).includes(opt)}
                            onCheckedChange={(checked) => handleCheckboxChange(field.id, opt, !!checked)}
                          />
                          <Label htmlFor={`${field.id}-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {field.fieldType === 'date' && (
                    <Input
                      id={field.id}
                      type="date"
                      required={field.required}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                    />
                  )}

                  {field.fieldType === 'heading' && (
                    <h3 className="text-lg font-semibold mt-4">{field.label}</h3>
                  )}

                  {field.fieldType === 'divider' && (
                    <hr className="my-4 border-t" />
                  )}
                </div>
              ))}

              <div>
                <Label htmlFor="dietaryPreferences">Dietary Preferences / Allergies</Label>
                <Input
                  id="dietaryPreferences"
                  value={formData.dietaryPreferences || ''}
                  onChange={(e) => handleInputChange('dietaryPreferences', e.target.value)}
                  placeholder="Vegetarian, gluten-free, etc."
                  data-testid="input-dietary"
                />
              </div>

              <div>
                <Label htmlFor="message">Message for the Couple (optional)</Label>
                <Textarea
                  id="message"
                  value={formData.message || ''}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  placeholder="Any special wishes or notes..."
                  rows={3}
                  data-testid="input-message"
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="w-full text-lg py-6"
                style={{ backgroundColor: primaryColor }}
                disabled={submitMutation.isPending}
                data-testid="submit-rsvp-btn"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit RSVP'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by KnotVite
        </p>
      </div>
    </div>
  );
}
