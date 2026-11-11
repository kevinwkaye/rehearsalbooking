export type AccountStatus='pending'|'approved'|'rejected'|'deactivated';
export type Profile={id:string;contact_name:string;email:string;role:'admin'|'band';status:AccountStatus;band_id:string|null;must_change_password:boolean};
export type Band={id:string;name:string;member_count:number;colour:string;archived_at?:string|null;created_at:string};
export type Booking={id:string;band_id:string;practice_date:string;start_time:string;status:'confirmed'|'cancelled';created_by:string;updated_at:string;created_at:string};
export type Notice={id:string;recipient_user_id:string;title:string;body:string;read_at:string|null;created_at:string};
export type Audit={id:string;actor_id:string|null;action:string;details:Record<string,unknown>;created_at:string};
