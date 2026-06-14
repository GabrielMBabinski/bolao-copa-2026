interface UserAvatarProps {
  name?: string;
  url?: string | null;
  className?: string; // Para você poder mudar o tamanho quando quiser (ex: w-12 h-12)
}

export default function UserAvatar({ name = '??', url, className = 'w-8 h-8 text-sm' }: UserAvatarProps) {
  return (
    <div 
      className={`shrink-0 rounded-full flex items-center justify-center font-bold bg-primary/10 text-primary uppercase overflow-hidden border border-primary/20 ${className}`}
    >
      {url ? (
        <img 
          src={url} 
          alt={`Avatar de ${name}`} 
          className="w-full h-full object-cover" 
        />
      ) : (
        <span>{name.substring(0, 2)}</span>
      )}
    </div>
  )
}