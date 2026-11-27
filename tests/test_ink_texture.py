import unittest
from PIL import Image,ImageDraw
from ink_texture import calculate

class InkTextureTests(unittest.TestCase):
 def test_lines_paper_transparency_and_global_bands(self):
  image=Image.new('L',(87,1103),200);draw=ImageDraw.Draw(image)
  for y in range(12,1103,43):draw.line((4,y,80,y+15),fill=80,width=2)
  before=image.tobytes()
  a,meta=calculate(image,None,65,band_rows=1103);b,_=calculate(image,None,65,band_rows=127)
  self.assertEqual(a.tobytes(),b.tobytes());self.assertTrue(meta['hasTexture']);self.assertEqual(image.tobytes(),before)
  alpha=Image.new('L',image.size,0);hidden,_=calculate(image,alpha,65);self.assertEqual(hidden.getextrema(),(0,0));a.close();b.close();hidden.close()
 def test_noise_is_suppressed_and_cancels(self):
  image=Image.new('L',(81,200));image.putdata([200+(i*17%3)-1 for i in range(81*200)])
  result,_=calculate(image,None,65);self.assertEqual(result.getextrema(),(0,0));result.close()
  with self.assertRaises(InterruptedError):calculate(image,None,cancelled=lambda:True)

if __name__=='__main__':unittest.main()
