import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class UpsertProductDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(0)
  available!: number;
}
