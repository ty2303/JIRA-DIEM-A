# Mo hinh du lieu du kien

Tai lieu nay mo ta mo hinh du lieu muc co so cho du an Website ban dien thoai.
Hien tai backend van su dung du lieu in-memory, nhung cac thuc the da duoc chuan
bi de chuyen sang database that o cac story sau.

## Thuc the chinh

### User

- `id`
- `username`
- `email`
- `password`
- `role`
- `hasPassword`
- `authProvider`
- `createdAt`

### Category

- `id`
- `name`
- `slug`
- `description`
- `icon`
- `createdAt`

### Product

- `id`
- `name`
- `brand`
- `categoryId`
- `price`
- `originalPrice`
- `image`
- `rating`
- `badge`
- `specs`
- `stock`
- `createdAt`
- `updatedAt`

### Review

- `id`
- `productId`
- `userId`
- `username`
- `rating`
- `comment`
- `images`
- `createdAt`

### Wishlist

- `userId`
- `productIds[]`

### Order

- `id`
- `userId`
- `email`
- `customerName`
- `phone`
- `address`
- `city`
- `district`
- `ward`
- `note`
- `paymentMethod`
- `status`
- `items`
- `subtotal`
- `shippingFee`
- `total`
- `createdAt`
- `paymentStatus`

## Quan he du lieu

- Mot `Category` co nhieu `Product`
- Mot `Product` thuoc mot `Category`
- Mot `User` co nhieu `Order`
- Mot `User` co the tao nhieu `Review`
- Mot `Product` co nhieu `Review`
- Mot `User` co mot `Wishlist`, ben trong gom nhieu `Product`

## Huong chuyen sang database that

- `users`
- `categories`
- `products`
- `reviews`
- `wishlists`
- `orders`
- `order_items`

Bang `order_items` nen duoc tach rieng khi chuyen sang DB de luu danh sach san
pham trong tung don hang.
