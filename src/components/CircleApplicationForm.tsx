import React, { useState } from 'react'
import { useForm, UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Checkbox } from './ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Upload, X, DollarSign } from 'lucide-react'

// Validation schema for the circle application form
const circleApplicationSchema = z.object({
  // Basic Circle Information
  circle_name: z.string().min(1, 'Circle name is required').max(100, 'Circle name must be less than 100 characters'),
  circle_name_furigana: z.string().optional(),
  
  // Representative Information (mapped to pen_name in DB)
  pen_name: z.string().min(1, 'Representative name is required'),
  pen_name_furigana: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  
  // Address Information
  address: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  
  // Co-Representative Information
  co_rep_name: z.string().optional(),
  co_rep_email: z.string().optional(),
  co_rep_phone: z.string().optional(),
  
  // Emergency Contact
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  
  // Social Media & Web Presence
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  twitter: z.string().optional(),
  instagram: z.string().optional(),
  pixiv: z.string().optional(),
  
  // Booth Configuration
  space_preference: z.enum(['circle_space_1', 'circle_space_2', 'circle_space_4', 'circle_booth_a', 'circle_booth_b']),
  space_size: z.string().optional(),
  additional_power: z.boolean(),
  additional_table: z.boolean(),
  additional_chair: z.boolean(),
  exhibitor_passes: z.number().min(1).max(4),
  
  // Content Information
  fandom: z.string().optional(),
  genre: z.string().optional(),
  rating: z.enum(['all_ages', 'r15', 'r18']),
  product_types: z.array(z.string()).optional(),
  description: z.string().optional(),
  works_description: z.string().optional(),
  previous_participation: z.boolean(),
  
  // Commission Information
  sells_commission: z.boolean(),
  marketplace_link: z.string().url('Invalid URL').optional().or(z.literal('')),
  
  // Special Requests
  special_requests: z.string().optional(),
  
  // Currency Selection
  currency: z.enum(['IDR', 'USD']),
})

type CircleApplicationFormData = z.infer<typeof circleApplicationSchema>

// Create a properly typed FormField component
const TypedFormField = FormField<CircleApplicationFormData>

interface CircleApplicationFormProps {
  eventId: string
  onSubmit?: (data: CircleApplicationFormData) => void
}

const SPACE_TYPES = [
  { value: 'circle_space_1', label: 'Circle Space (1 space)', price_idr: 150000, price_usd: 10 },
  { value: 'circle_space_2', label: 'Circle Space (2 spaces)', price_idr: 280000, price_usd: 18 },
  { value: 'circle_space_4', label: 'Circle Space (4 spaces)', price_idr: 520000, price_usd: 35 },
  { value: 'circle_booth_a', label: 'Circle Booth A', price_idr: 800000, price_usd: 55 },
  { value: 'circle_booth_b', label: 'Circle Booth B', price_idr: 1200000, price_usd: 80 },
]

const PRODUCT_TYPES = [
  'Doujinshi/Comics',
  'Illustrations/Art Books',
  'Novels/Light Novels',
  'Games/Software',
  'Music/Audio',
  'Merchandise/Goods',
  'Cosplay Items',
  'Accessories',
  'Stickers/Prints',
  'Other'
]

const GENRES = [
  'Original',
  'Anime/Manga',
  'Games',
  'Novels',
  'Movies/TV',
  'Music',
  'Historical',
  'Fantasy',
  'Sci-Fi',
  'Romance',
  'Comedy',
  'Drama',
  'Horror',
  'Other'
]

export default function CircleApplicationForm({ eventId, onSubmit }: CircleApplicationFormProps) {
  const [uploadedImages, setUploadedImages] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const form: UseFormReturn<CircleApplicationFormData> = useForm<CircleApplicationFormData>({
    resolver: zodResolver(circleApplicationSchema),
    defaultValues: {
      circle_name: '',
      circle_name_furigana: '',
      pen_name: '',
      pen_name_furigana: '',
      email: '',
      phone: '',
      address: '',
      postal_code: '',
      country: '',
      co_rep_name: '',
      co_rep_email: '',
      co_rep_phone: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      website: '',
      twitter: '',
      instagram: '',
      pixiv: '',
      space_preference: 'circle_space_1' as const,
      space_size: '',
      additional_power: false,
      additional_table: false,
      additional_chair: false,
      exhibitor_passes: 1,
      fandom: '',
      genre: '',
      rating: 'all_ages' as const,
      product_types: [],
      description: '',
      works_description: '',
      previous_participation: false,
      sells_commission: false,
      marketplace_link: '',
      special_requests: '',
      currency: 'IDR' as const,
    },
  })
  
  const watchedSpaceType = form.watch('space_preference')
  const watchedCurrency = form.watch('currency')
  const watchedProductTypes = form.watch('product_types')
  
  const selectedSpaceType = SPACE_TYPES.find(type => type.value === watchedSpaceType)
  const totalPrice = selectedSpaceType ? 
    (watchedCurrency === 'IDR' ? selectedSpaceType.price_idr : selectedSpaceType.price_usd) : 0
  
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/')
      const isValidSize = file.size <= 5 * 1024 * 1024 // 5MB limit
      return isValidType && isValidSize
    })
    
    if (validFiles.length !== files.length) {
      toast.error('Some files were rejected. Please ensure all files are images under 5MB.')
    }
    
    setUploadedImages(prev => [...prev, ...validFiles].slice(0, 5)) // Max 5 images
  }
  
  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
  }
  
  const handleProductTypeChange = (productType: string, checked: boolean) => {
    const currentTypes = watchedProductTypes || []
    if (checked) {
      form.setValue('product_types', [...currentTypes, productType])
    } else {
      form.setValue('product_types', currentTypes.filter(type => type !== productType))
    }
  }
  
  const onFormSubmit = async (data: CircleApplicationFormData) => {
    setIsSubmitting(true)
    try {
      // Upload images to Supabase Storage
      const imageUrls: string[] = []
      
      for (const image of uploadedImages) {
        const fileExt = image.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `sample-works/${fileName}`
        
        const { error: uploadError } = await supabase.storage
          .from('circle-files')
          .upload(filePath, image)
        
        if (uploadError) {
          throw uploadError
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('circle-files')
          .getPublicUrl(filePath)
        
        imageUrls.push(publicUrl)
      }
      
      // Generate unique circle code
      const circleCode = `C${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 4).toUpperCase()}`
      
      // Prepare circle data
      const circleData = {
        ...data,
        event_id: eventId,
        circle_code: circleCode,
        sample_works_images: imageUrls,
        total_amount: totalPrice,
        application_status: 'pending' as const,
        payment_status: 'pending' as const,
      }
      
      // Insert circle application
      const { error: insertError } = await supabase
        .from('circles')
        .insert([circleData])
      
      if (insertError) {
        throw insertError
      }
      
      toast.success('Circle application submitted successfully!')
      onSubmit?.(data)
      form.reset()
      setUploadedImages([])
      
    } catch (error) {
      console.error('Error submitting application:', error)
      toast.error('Failed to submit application. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Circle Application Form</h1>
        <p className="text-muted-foreground">
          Please fill out all required fields to apply for a booth at the event.
        </p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-8">
          {/* Basic Circle Information */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Circle Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TypedFormField
                control={form.control}
                name="circle_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Circle Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter circle name" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="circle_name_furigana"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Circle Name (Furigana)</FormLabel>
                    <FormControl>
                      <Input placeholder="サークル名（ふりがな）" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <TypedFormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Circle Description *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe your circle, what you create, and what visitors can expect..."
                      className="min-h-[120px]"
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormDescription>
                    This will be displayed in the event catalog
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {/* Representative Information */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Representative Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TypedFormField
                control={form.control}
                name="pen_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Representative Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter representative name" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="pen_name_furigana"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Representative Name (Furigana)</FormLabel>
                    <FormControl>
                      <Input placeholder="代表者名（ふりがな）" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TypedFormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email address" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          
          {/* Co-Representative Information */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Co-Representative (Optional)</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TypedFormField
                control={form.control}
                name="co_rep_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Co-Representative Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter co-representative name" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="co_rep_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Co-Representative Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter co-representative email" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="co_rep_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Co-Representative Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter co-representative phone" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          
          {/* Address Information */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Address Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TypedFormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter postal code" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter country" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full address" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          
          {/* Emergency Contact */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Emergency Contact</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TypedFormField
                control={form.control}
                name="emergency_contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter emergency contact name" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="emergency_contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter emergency contact phone" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              

            </div>
          </div>
          
          {/* Social Media & Web Presence */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Social Media &amp; Web Presence</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TypedFormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="twitter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Twitter Handle</FormLabel>
                    <FormControl>
                      <Input placeholder="@username" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TypedFormField
                control={form.control}
                name="instagram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instagram Handle</FormLabel>
                    <FormControl>
                      <Input placeholder="@username" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="pixiv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pixiv ID</FormLabel>
                    <FormControl>
                      <Input placeholder="pixiv.net/users/123456" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          
          {/* Booth Configuration */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Booth Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <TypedFormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="IDR">
                            <div className="flex items-center gap-2">
                              <span>IDR (Indonesian Rupiah)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="USD">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              <span>USD (US Dollar)</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <TypedFormField
                control={form.control}
                name="space_preference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Space Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select space type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SPACE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex justify-between items-center w-full">
                              <span>{type.label}</span>
                              <span className="ml-4 font-semibold">
                                {watchedCurrency === 'IDR' 
                                  ? `IDR ${type.price_idr.toLocaleString()}` 
                                  : `$${type.price_usd}`
                                }
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
              
              <div className="space-y-4">
                {selectedSpaceType && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">Pricing Summary</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>{selectedSpaceType.label}</span>
                        <span className="font-semibold">
                          {watchedCurrency === 'IDR' 
                            ? `IDR ${totalPrice.toLocaleString()}` 
                            : `$${totalPrice}`
                          }
                        </span>
                      </div>
                      <div className="border-t pt-1 flex justify-between font-semibold">
                        <span>Total</span>
                        <span>
                          {watchedCurrency === 'IDR' 
                            ? `IDR ${totalPrice.toLocaleString()}` 
                            : `$${totalPrice}`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <TypedFormField
              control={form.control}
              name="space_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Space Size Preference</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any specific location preferences or requirements?"
                      className="min-h-[80px]"
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormDescription>
                    Please describe any specific location preferences (e.g., near entrance, corner booth, etc.)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TypedFormField
                control={form.control}
                name="additional_power"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value as boolean}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Additional Power</FormLabel>
                      <FormDescription>
                        Check if you need additional power
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="additional_table"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value as boolean}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Additional Table</FormLabel>
                      <FormDescription>
                        Check if you need an additional table
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="additional_chair"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value as boolean}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Additional Chair</FormLabel>
                      <FormDescription>
                        Check if you need an additional chair
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>
          
          {/* Content Information */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Content Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TypedFormField
                control={form.control}
                name="fandom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fandom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter main fandom/series" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="genre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Genre *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select genre" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GENRES.map((genre) => (
                          <SelectItem key={genre} value={genre}>
                            {genre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TypedFormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content Rating *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select content rating" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all_ages">All Ages</SelectItem>
                        <SelectItem value="r15">R15+ (Ages 15 and up)</SelectItem>
                        <SelectItem value="r18">R18+ (Adults only)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <TypedFormField
                control={form.control}
                name="exhibitor_passes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exhibitor Passes *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Number of exhibitor passes needed"
                        min="1"
                        max="4"
                        {...field}
                        value={field.value as string}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium">Product Types *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                {PRODUCT_TYPES.map((productType) => (
                  <div key={productType} className="flex items-center space-x-2">
                    <Checkbox
                      id={productType}
                      checked={watchedProductTypes?.includes(productType) || false}
                      onCheckedChange={(checked) => handleProductTypeChange(productType, checked as boolean)}
                    />
                    <Label htmlFor={productType} className="text-sm font-normal">
                      {productType}
                    </Label>
                  </div>
                ))}
              </div>
              {form.formState.errors.product_types && (
                <p className="text-sm font-medium text-destructive mt-1">
                  {form.formState.errors.product_types.message}
                </p>
              )}
            </div>
            
            <TypedFormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Circle Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe your circle and what you do"
                      className="min-h-[100px]"
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormDescription>
                    Tell us about your circle, your artistic style, and what makes you unique
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <TypedFormField
              control={form.control}
              name="works_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Works Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the works you'll be selling at this event"
                      className="min-h-[100px]"
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe the specific works, merchandise, or content you plan to sell
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {/* Previous Participation */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Previous Participation</h2>
            
            <TypedFormField
              control={form.control}
              name="previous_participation"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value as boolean}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Previous Participation</FormLabel>
                    <FormDescription>
                      Check if you have participated in similar events before
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            

          </div>
          
          {/* Commission Information */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Commission Information</h2>
            
            <TypedFormField
              control={form.control}
              name="sells_commission"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value as boolean}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Sells Commission</FormLabel>
                    <FormDescription>
                      Check if you offer commission services
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            {form.watch('sells_commission') && (
              <TypedFormField
                control={form.control}
                name="marketplace_link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marketplace Link</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/shop" {...field} value={field.value as string} />
                    </FormControl>
                    <FormDescription>Link to your online marketplace</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
          
          {/* Sample Works */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Sample Works</h2>
            

            
            <div>
              <Label className="text-sm font-medium mb-2 block">Sample Works Images</Label>
              <div className="space-y-4">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-muted/50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold">Click to upload</span> sample work images
                      </p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 5MB (Max 5 images)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
                
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {uploadedImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Sample work ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Special Requests */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Additional Information</h2>
            
            <TypedFormField
              control={form.control}
              name="special_requests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Requests</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any special requests or additional information you'd like to share..."
                      className="min-h-[100px]"
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormDescription>
                    Please include any special accommodations or requests
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {/* Submit Button */}
          <div className="flex justify-center pt-6">
            <Button 
              type="submit" 
              size="lg" 
              disabled={isSubmitting}
              className="w-full md:w-auto min-w-[200px]"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}