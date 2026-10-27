import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsEmail() @Length(3, 254) email!: string;
  @IsString() @Length(2, 60) name!: string;
  @IsString()
  @Length(10, 72)
  @Matches(/\S/, { message: 'Пароль не может состоять из пробелов' })
  password!: string;
}
export class LoginDto {
  @IsEmail() @Length(3, 254) email!: string;
  @IsString() @Length(1, 72) password!: string;
}
export class CatDto {
  @IsString() @Length(2, 60) name!: string;
  @IsString() @Length(2, 80) breed!: string;
  @IsString() @Length(10, 1000) bio!: string;
  @IsOptional()
  @Matches(
    /^(?:\/cats\/(?:marmalade|luna|oliver|mochi)\.(?:svg|jpg)|\/api\/cats\/[0-9a-f-]{36}\/avatar\?v=[0-9a-f-]{36})$/,
  )
  avatar?: string;
}
export class PostDto {
  @IsString() @Length(2, 120) title!: string;
  @IsString() @Length(1, 5000) body!: string;
  @IsBoolean() isPrivate!: boolean;
}
export class SubscribeDto {
  @IsUUID() catId!: string;
}

export class CommentDto {
  @IsString() @Length(1, 1000) @Matches(/\S/) body!: string;
}
