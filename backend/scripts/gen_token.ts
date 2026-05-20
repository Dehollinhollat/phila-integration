import 'dotenv/config';
import jwt from 'jsonwebtoken';

const payload = {
  id: 'cmokgivj20000vcv0dnwj8vr5',
  email: 'deohmagique@gmail.com',
  role: 'super_admin',
  campus: []
};
const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h', algorithm: 'HS256' });
console.log(token);
