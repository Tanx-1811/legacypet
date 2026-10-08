<div align="center">

# 🐾 LegacyPet

**Repo của bạn có một con thú cưng. Đừng để nó thành thây ma.**

Một con thú pixel sống trong README, cảm nhận đúng tình trạng dự án của bạn:
ăn bằng commit, khỏe nhờ CI xanh, vui khi issue được trả lời.

[![Thú của chính dự án](https://raw.githubusercontent.com/Tanx-1811/legacypet/legacypet/pet-badge.svg)](https://github.com/Tanx-1811/legacypet/blob/legacypet/DIARY.md)

[English](README.md) · [Tiếng Việt](README.vi.md) · **[🔮 Xem trước thú của repo bạn](https://tanx-1811.github.io/legacypet/)**

<img src="docs/gallery/hero/hero-vi.svg" alt="Bánh Bao Đói Meo, một con mèo đang đói" width="520">

</div>

## Vì sao?

Ai ghé repo của bạn cũng tự hỏi: **dự án này còn sống không?**
Số sao không trả lời được câu đó. Biểu đồ commit thì phải ngồi đọc.
Nhìn con thú một cái là biết ngay, và bạn cũng có thêm một lý do dễ thương để quay lại chăm code.

- 🍖 **Commit là thức ăn.** Ngừng push thì nó đói. Sáu tháng sau nó đội mồ sống dậy.
- ❤️ **CI giữ sức khỏe.** Build đỏ thì nó sốt và phải chườm đá.
- 😊 **Issue quyết định tâm trạng.** Bỏ mặc người khác không trả lời thì một đám mây mưa sẽ bám theo nó.
- 🎉 **Release là tiệc.** Có pháo giấy, mũ tiệc và lời cảm ơn người đóng góp.
- 📔 **Nó viết nhật ký** từng ngày trong đời dự án của bạn.

Tất cả chạy trong một GitHub Action: không server, không đăng ký, không theo dõi, không có dependency nào.

## Cách dùng

### Cách 1: xem trước trên web (không cần cài gì)

Mở **[playground](https://tanx-1811.github.io/legacypet/)**, gõ `owner/repo` bất kỳ để xem nó nở ra con gì,
kèm bảng khám sức khỏe repo. Gửi link cho bạn bè khoe luôn.

### Cách 2: một lệnh duy nhất (khuyên dùng)

Chạy trong thư mục repo của bạn:

```sh
npx github:Tanx-1811/legacypet init --lang vi
```

Lệnh này tạo `.github/workflows/legacypet.yml`, chèn con thú lên đầu `README.md` và vẽ thử con thú ngay trong terminal. Sau đó:

```sh
git add . && git commit -m "Nhận nuôi LegacyPet 🐾" && git push
```

Vào tab **Actions** → **LegacyPet** → **Run workflow** (hoặc đợi lịch tự chạy), rồi tải lại README.

Nếu chạy trong repo profile (`ten-ban/ten-ban`), lệnh sẽ tự tạo **Công viên thú** gom tất cả thú của bạn.

### Cách 3: làm tay

**1.** Tạo file [`.github/workflows/legacypet.yml`](examples/legacypet.yml):

```yaml
name: LegacyPet
on:
  schedule:
    - cron: '17 */6 * * *'
  release:
    types: [published]
  workflow_dispatch:
  issue_comment:
    types: [created] # nói chuyện với thú bằng /pet

permissions:
  contents: write
  actions: write
  issues: write
  pull-requests: write
  checks: read
  statuses: read

jobs:
  legacypet:
    if: github.event_name != 'issue_comment' || startsWith(github.event.comment.body, '/pet')
    runs-on: ubuntu-latest
    steps:
      - uses: Tanx-1811/legacypet@v1
        with:
          lang: vi
```

**2.** Chạy workflow một lần trong tab **Actions**, rồi dán vào README (thay `OWNER/REPO`):

```md
[![LegacyPet](https://raw.githubusercontent.com/OWNER/REPO/legacypet/pet.svg)](https://github.com/OWNER/REPO/blob/legacypet/DIARY.md)
```

Xong! Thú cưng sống trên nhánh riêng `legacypet`, nên lịch sử nhánh chính vẫn sạch.

## Tâm trạng

| Tâm trạng | Khi nào |
| --- | --- |
| 💤 Ngủ đông | Repo đã được lưu trữ (archived) |
| 🥚 Trứng | Chưa đủ 5 commit, mỗi commit làm vỏ nứt thêm một chút |
| 🧟 Thây ma | 180 ngày không có commit |
| 🥳 Quẩy | Vừa nở, vừa hồi sinh, vừa release trong 3 ngày, sinh nhật repo, Năm mới, Tết, Ngày Lập trình viên |
| 🤒 Ốm | CI trên nhánh mặc định đang đỏ |
| 🍖 Đói | Khoảng 25 ngày không có commit |
| 🥺 Buồn | Issue và PR bị bỏ rơi |
| 😴 Buồn ngủ | Hai tuần không có commit |
| 🤩 Phấn khích | Trung bình các chỉ số từ 80 trở lên |
| 😊 Vui | Mọi thứ còn lại |

## 13 loài, mỗi loài một đặc tính

| Loài | Đặc tính | Tác dụng |
| --- | --- | --- |
| Slime | Linh hoạt | Cân bằng hoàn hảo |
| Mèo | Độc lập | Issue bị bỏ rơi chỉ làm nó buồn một nửa |
| Vịt cao su | Thợ gỡ lỗi | CI đỏ ít ảnh hưởng hơn 35% |
| Cua | Lột xác | +15 niềm vui trong 2 tuần sau mỗi release (repo Rust luôn ra cua 🦀) |
| Bạch tuộc | Đa nhiệm | +6 năng lượng cho mỗi người đóng góp thêm |
| Rắn | Kiên nhẫn | Đói chậm hơn 40% (repo Python luôn ra rắn 🐍) |
| Xương rồng | Chịu hạn | Đói chậm gấp 4 lần, hợp với dự án đã hoàn thành |

### 🦸 Biệt đội anh hùng

Sáu nhân vật nguyên bản lấy cảm hứng từ anime và phim hoạt hình siêu anh hùng, mỗi bé mang một luật chơi mới:

| | Loài | Đặc tính | Tác dụng |
| :-: | --- | --- | --- |
| <img src="docs/gallery/species/ninja.svg" width="70"> | Cáo Ninja (`ninja`) | Phân thân | Mỗi ngày trong chuỗi commit +4 năng lượng (tối đa +24) |
| <img src="docs/gallery/species/mecha.svg" width="70"> | Người máy Mecha (`mecha`) | Lò phản ứng | CI xanh thì năng lượng không bao giờ dưới 40 |
| <img src="docs/gallery/species/dragon.svg" width="70"> | Rồng Thần (`dragon`) | Sức mạnh cổ xưa | Lên cấp nhanh hơn 50% |
| <img src="docs/gallery/species/bunny.svg" width="70"> | Thỏ Phép Thuật (`bunny`) | Ánh sao | +2 niềm vui cho mỗi 100 sao (tối đa +20) |
| <img src="docs/gallery/species/bat.svg" width="70"> | Hiệp sĩ Bóng đêm (`bat`) | Canh gác | +15 niềm vui khi không issue nào phải chờ phản hồi |
| <img src="docs/gallery/species/hero.svg" width="70"> | Siêu Cún (`hero`) | Thân thép | CI đỏ cũng không kéo sức khỏe xuống dưới 40 |

Thú đã nở thì giữ nguyên loài, kể cả khi có loài mới được thêm vào.

### 💥 Siêu hình thái

Giữ cho thú **phấn khích 7 ngày liền** là nó biến hình: hào quang vàng rực và cúp 💥 Siêu hình thái.

<img src="docs/gallery/aura/ninja.svg" width="90"> <img src="docs/gallery/aura/dragon.svg" width="90"> <img src="docs/gallery/aura/bunny.svg" width="90"> <img src="docs/gallery/aura/hero.svg" width="90">

Cứ 64 repo thì có 1 repo nở ra thú **lấp lánh (shiny)** ✨, và không có cách nào quay lại.

### 🏝️ Quê nhà của từng loài

Mỗi loài có một nơi ở riêng, và nơi nào cũng sống động:

<img src="docs/gallery/homes/meadow.svg" width="100" alt="meadow"> <img src="docs/gallery/homes/garden.svg" width="100" alt="garden"> <img src="docs/gallery/homes/pond.svg" width="100" alt="pond"> <img src="docs/gallery/homes/beach.svg" width="100" alt="beach"> <img src="docs/gallery/homes/reef.svg" width="100" alt="reef"> <img src="docs/gallery/homes/jungle.svg" width="100" alt="jungle"> <img src="docs/gallery/homes/desert.svg" width="100" alt="desert">

- 🌳 **Đồng cỏ** (Slime, Siêu Cún): đồi xa có cối xay gió quay, cây đổi màu theo mùa, bướm bay
- 🏡 **Khu vườn** (Mèo, Thỏ): căn nhà nhỏ sáng đèn ban đêm, hàng rào trắng, hoa hướng dương đung đưa
- 🦆 **Ao** (Vịt): mặt nước lấp lánh, gợn sóng lan tròn, bông lau rung rinh
- 🏖️ **Bãi biển** (Cua): sóng vỗ, bọt biển tràn lên cát, cây dừa, hải âu, vỏ sò và lâu đài cát
- 🐠 **Rạn san hô** (Bạch tuộc): dưới nước có tia nắng, rong biển, san hô, bong bóng và cá bơi ngang. Ban đêm sinh vật phát sáng
- 🌴 **Rừng rậm** (Rắn, Cáo Ninja, Hiệp sĩ Bóng đêm): thác nước, dây leo, sương mù, đom đóm khi trời tối
- 🏜️ **Sa mạc** (Xương rồng, Rồng Thần, Mecha): núi đá đỉnh bằng, hơi nóng bốc lên, bụi cỏ lăn qua

Ban đêm (dark mode) có sao băng, mùa đông có cả cực quang:

<img src="docs/gallery/homes/meadow-night.svg" width="100" alt="meadow"> <img src="docs/gallery/homes/garden-night.svg" width="100" alt="garden"> <img src="docs/gallery/homes/pond-night.svg" width="100" alt="pond"> <img src="docs/gallery/homes/beach-night.svg" width="100" alt="beach"> <img src="docs/gallery/homes/reef-night.svg" width="100" alt="reef"> <img src="docs/gallery/homes/jungle-night.svg" width="100" alt="jungle"> <img src="docs/gallery/homes/desert-night.svg" width="100" alt="desert">

Tâm trạng cũng đổi cảnh: phấn khích hay tiệc tùng thì có cầu vồng, ngày tiệc giăng cờ dây, còn thú zombie thì cây trụi lá, dơi bay và sương mù phủ kín.
Muốn chuyển nhà? Đặt `scenery: beach` (hoặc `--scenery beach` trong CLI).

### Chọn kiểu hiển thị

| File | Dùng cho |
| --- | --- |
| `pet.svg` | Thẻ đầy đủ, đặt đầu README dự án |
| `pet-mini.svg` | Thẻ nhỏ, đặt ở sidebar hoặc bảng |
| `pet-badge.svg` | Badge <img src="docs/gallery/badges/ecstatic.svg"> đặt cạnh các badge khác |
| `park.svg` | Công viên thú trên profile README |
| `pet-shields.json` | Badge kiểu [shields.io](https://shields.io/badges/endpoint-badge) |

## 💬 Nói chuyện với thú: `/pet`

Bình luận trong bất kỳ issue hay pull request nào, thú sẽ trả lời ngay trong thread, bằng ngôn ngữ của nó:

| Lệnh | Thú trả lời |
| --- | --- |
| `/pet` | Thẻ, tâm trạng, chỉ số và kết quả khám sức khỏe |
| `/pet pat` | Xoa đầu 💕 |
| `/pet checkup` | Chỉ phần khám sức khỏe |
| `/pet help` | Danh sách lệnh |

Cần trigger `issue_comment` và quyền `issues: write` / `pull-requests: write` (đã có sẵn trong workflow mẫu ở trên).

## 🌍 7 ngôn ngữ

`lang:` nhận `en`, `vi`, `ja` (日本語), `zh` (中文), `ko` (한국어), `es` (Español), `fr` (Français).
Tiếng Nhật, Trung, Hàn được ngắt dòng đúng trong bong bóng thoại.

## 🏞️ Công viên thú

<img src="docs/gallery/park/park-vi.svg" alt="Công viên thú với sáu con thú" width="840">

Thêm `park: auto` vào workflow trong repo profile (lấy 6 repo nhiều sao nhất của bạn), hoặc liệt kê `park: app, dotfiles, owner-khac/lib`.

## 🩺 Khám sức khỏe repo

Mỗi lần chạy, action viết vào job summary lý do con thú đang vui hay buồn và việc nên làm,
ví dụ *"3 issue từ cộng đồng đang chờ phản hồi đầu tiên. Lâu nhất là #12 (87 ngày)"*.

## Còn gì nữa?

- 🎂 Lớn lên: Trứng → Bé (có mầm cây) → Trưởng thành → Lão làng (đeo kính một tròng)
- 🏆 17 cúp vĩnh viễn: Bốc lửa (chuỗi 7 ngày), Hồi sinh, Siêu sao (kèm vương miện), Phản hồi thần tốc, Kỷ niệm…
- 🍂 Theo mùa: hoa xuân, đom đóm hè, lá thu, tuyết đông. Ở dark mode thì thành ban đêm có trăng sao, sao băng và cực quang mùa đông
- 🧧 Ngày lễ: Tết có đèn lồng, pháo hoa và cành mai vàng rụng cánh, Halloween có mũ phù thủy và đàn dơi, Giáng sinh có mũ ông già Noel, người tuyết và dây đèn nhấp nháy
- 💬 Lời thoại theo dữ liệu thật: *"Này... issue #12 chờ phản hồi 87 ngày rồi đó"*
- ♿ Hỗ trợ trình đọc màn hình và tự tắt chuyển động khi người xem bật reduced motion

- 🆕 Tự báo tính năng mới: `@v1` luôn trỏ tới bản 1.x mới nhất nên bạn được cập nhật tự động. Lần đầu chạy bản mới, trang Actions hiện thông báo và job summary liệt kê **có gì mới**, kèm hướng dẫn nếu cần sửa workflow

Xem chi tiết công thức tính chỉ số, cấu hình và FAQ trong [README tiếng Anh](README.md).

## Đóng góp

Cách đóng góp dễ nhất là **vẽ một loài mới**: một lưới 16×16 ký tự, một bảng màu và một đặc tính.
Mất khoảng 10 phút, và `npm run gallery` cho xem ngay loài đó ở mọi tâm trạng. Xem [CONTRIBUTING.md](CONTRIBUTING.md).

## Giấy phép

[MIT](LICENSE)
