<div align="center">

# 🐾 LegacyPet

**Repo của bạn có một con thú cưng. Đừng để nó thành thây ma.**

Một con thú pixel sống trong README, cảm nhận đúng tình trạng dự án của bạn:
ăn bằng commit, khỏe nhờ CI xanh, vui khi issue được trả lời.

[![Thú của chính dự án](https://raw.githubusercontent.com/Tanx-1811/legacypet/legacypet/pet-badge.svg)](https://github.com/Tanx-1811/legacypet/blob/legacypet/DIARY.md)
[![CI](https://github.com/Tanx-1811/legacypet/actions/workflows/ci.yml/badge.svg)](https://github.com/Tanx-1811/legacypet/actions/workflows/ci.yml)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)

[English](README.md) · [Tiếng Việt](README.vi.md) · **[🔮 Xem trước thú của repo bạn](https://tanx-1811.github.io/legacypet/)**

<img src="docs/gallery/hero/hero-vi.svg" alt="Bánh Bao Đói Meo, một con mèo đang đói" width="520">

**🆕 Bản 1.3:** [nhiệm vụ tuần](#-nhiệm-vụ-tuần) · [tiến hóa](#-tiến-hóa) · [tủ đồ](#-tủ-đồ) · [cho ăn, chơi với thú](#-ăn-vặt-và-chơi-đùa) · [playground nuôi thử](#️-playground) · [xem tất cả](CHANGELOG.md)

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
- 🩺 **Nó khám sức khỏe repo**: chỉ ra chỗ chưa ổn và việc nên làm.
- 💬 **Nó nói chuyện được**: gõ `/pet` trong issue hay PR là nó trả lời, bằng 7 thứ tiếng.
- 🏞️ **Mọi thú của bạn tụ họp trong Công viên thú** trên profile README.

Tất cả chạy trong một GitHub Action: không server, không đăng ký, không theo dõi, không có dependency nào.

## Cách dùng

### Cách 1: một cú click trên web (không cần cài gì, khuyên dùng)

Mở **[playground](https://tanx-1811.github.io/legacypet/)**, gõ `owner/repo` của bạn để xem nó nở ra con gì,
kèm bảng khám sức khỏe repo. Ưng rồi thì bấm **🐾 Adopt on GitHub**: GitHub mở sẵn file workflow đã điền xong,
bạn chỉ cần bấm **Commit changes**, khoảng một phút sau thú tự nở. Cuối cùng dán đoạn snippet trang web đưa vào README là xong.

### Cách 2: một lệnh duy nhất

Chạy trong thư mục repo của bạn:

```sh
npx github:Tanx-1811/legacypet init --lang vi
```

Lệnh này tạo `.github/workflows/legacypet.yml`, chèn con thú lên đầu `README.md` và vẽ thử con thú ngay trong terminal. Sau đó:

```sh
git add . && git commit -m "Nhận nuôi LegacyPet 🐾" && git push
```

### Cách 3: chọn nhiều repo từ danh sách, không cần clone

```sh
npx github:Tanx-1811/legacypet adopt --lang vi
```

Lệnh này liệt kê các repo của bạn (🐾 là đã có thú, 🔒 là repo riêng tư) rồi hỏi bạn chọn repo nào (`1,3`, `2-5`, `all` hoặc gõ tên).
Sau đó nó commit workflow và snippet README vào từng repo qua API. Lệnh dùng `$GITHUB_TOKEN` hoặc tài khoản `gh` đang đăng nhập.
Muốn ghi được file workflow thì token cần quyền `workflow`: chạy `gh auth refresh -s workflow`. Với repo của tổ chức thì thêm tên vào sau, ví dụ `adopt ten-to-chuc`.

Trên trang web cũng vậy: gõ một **username** (hoặc bấm **📂 Repo của tôi** sau khi thêm token) để hiện danh sách repo, mỗi repo có nút **🏡 Nhận nuôi**.

Khoảng một phút sau khi push, thú tự nở. Tải lại README để chào nó nhé!

Tùy chọn: `--species ninja`, `--scenery beach`, `--name "Bánh Bao"`, `--style badge`.
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
  push:
    paths: ['.github/workflows/legacypet.yml'] # nở ngay khi bạn commit file này
  workflow_dispatch:
  issue_comment:
    types: [created] # nói chuyện với thú bằng /pet

permissions:
  contents: write # đăng thú lên nhánh `legacypet`
  actions: write # giữ lịch chạy khi repo im ắng
  issues: write # trả lời /pet trong issue
  pull-requests: write # ...và trong pull request
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

**2.** Commit file đó là thú tự nở, rồi dán vào README (thay `OWNER/REPO`):

```md
[![LegacyPet](https://raw.githubusercontent.com/OWNER/REPO/legacypet/pet.svg)](https://github.com/OWNER/REPO/blob/legacypet/DIARY.md)
```

Xong! Thú cưng sống trên nhánh riêng `legacypet`, nên lịch sử nhánh chính vẫn sạch.

### 🏖️ Chế độ đi nghỉ

Maintainer cũng cần nghỉ ngơi. Đặt `vacation: until 2027-01-05` trong workflow, hoặc comment `/pet vacation 14` vào issue bất kỳ (`/pet back` để về sớm).
Trong lúc bạn vắng nhà, thú ngừng đói và **những ngày nghỉ không bao giờ bị tính**. Nó ra biển đeo kính râm để người ghé repo biết dự án không bị bỏ rơi.
Mỗi kỳ nghỉ tối đa 60 ngày.

<img src="docs/gallery/care/vacation.svg" width="110" alt="Mèo đeo kính râm trên bãi biển">

### 🚨 Báo động chăm sóc

Bật `alerts: true` thì khi thú bị ốm (CI đỏ) hoặc thành zombie, nó mở **một** issue kèm phiếu khám sức khỏe, tự cập nhật trong lúc còn bệnh và tự đóng khi khỏe lại.
Phải hai lần chạy liên tiếp mới mở, nên một lần build chập chờn sẽ không làm phiền bạn. Tự tay đóng issue thì nó im lặng cho tới khi thú khỏe.
Chọn tâm trạng muốn báo: `alerts: sick, zombie, hungry, sad`.

### 📈 Biểu đồ 30 ngày

`pet-stats.svg` vẽ độ no, sức khỏe, niềm vui và năng lượng trong 30 ngày qua, kèm tâm trạng từng ngày, để bạn thấy repo đang đi lên hay đi xuống.

<img src="docs/gallery/care/stats.svg" width="520" alt="Biểu đồ chỉ số 30 ngày">

### Chọn kiểu hiển thị

| File | Trông thế nào | Dùng cho |
| --- | --- | --- |
| `pet.svg` | thẻ ở đầu trang này | đầu README dự án |
| `pet-mini.svg` | <img src="docs/gallery/moods/happy.svg" width="70"> | sidebar, bảng, profile README |
| `pet-badge.svg` | <img src="docs/gallery/badges/ecstatic.svg"> | cạnh các badge khác |
| `park.svg` | xem [Công viên thú](#️-công-viên-thú) | profile README |
| `pet-shields.json` | badge kiểu [shields.io](https://shields.io/badges/endpoint-badge) | hàng badge kiểu shields.io |

Đổi tên file trong đoạn markdown ở trên là xong. Badge shields.io thì dùng:

```md
![pet](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FOWNER%2FREPO%2Flegacypet%2Fpet-shields.json)
```

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

Repo tự chọn thú cho mình: repo Rust luôn nở ra cua 🦀, repo Python luôn ra rắn 🐍, còn lại tùy tên repo.

| | Loài | Đặc tính | Tác dụng |
| :-: | --- | --- | --- |
| <img src="docs/gallery/species/blob.svg" width="70"> | Slime (`blob`) | Linh hoạt | Cân bằng hoàn hảo |
| <img src="docs/gallery/species/cat.svg" width="70"> | Mèo (`cat`) | Độc lập | Issue bị bỏ rơi chỉ làm nó buồn một nửa |
| <img src="docs/gallery/species/duck.svg" width="70"> | Vịt cao su (`duck`) | Thợ gỡ lỗi | CI đỏ ít ảnh hưởng hơn 35% |
| <img src="docs/gallery/species/crab.svg" width="70"> | Cua (`crab`) | Lột xác | +15 niềm vui trong 2 tuần sau mỗi release |
| <img src="docs/gallery/species/octopus.svg" width="70"> | Bạch tuộc (`octopus`) | Đa nhiệm | +6 năng lượng cho mỗi người đóng góp thêm |
| <img src="docs/gallery/species/snake.svg" width="70"> | Rắn (`snake`) | Kiên nhẫn | Đói chậm hơn 40% |
| <img src="docs/gallery/species/cactus.svg" width="70"> | Xương rồng (`cactus`) | Chịu hạn | Đói chậm gấp 4 lần, hợp với dự án đã hoàn thành |

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

Mỗi bé còn có câu cửa miệng riêng (*"Bay lên nào, deploy! 🦸"*, *"\*bùm\* Thuật phân thân commit! 🍥"*).
Thú đã nở thì giữ nguyên loài, kể cả khi có loài mới được thêm vào.

### 🕺 Động tác đặc trưng

Những ngày vui (vui, phấn khích, quẩy), mỗi loài lại khoe một động tác riêng vài giây một lần, thêm vào chuyển động theo tâm trạng.
Khi thú mệt hay ốm thì nó thôi, và người xem bật reduced motion thì cũng tắt.

| Loài | Động tác | | Loài | Động tác |
| --- | --- | --- | --- | --- |
| Slime | nén dẹp rồi bật nảy | | Cáo Ninja | lướt nhanh như chớp, để lại hai bóng phân thân |
| Mèo | vươn vai thật dài | | Mecha | ngồi thụp, khai hỏa động cơ rồi bay lơ lửng |
| Vịt cao su | lạch bạch qua lại | | Rồng Thần | bay lên và uốn lượn |
| Cua | bước ngang | | Thỏ Phép Thuật | xoay một vòng biến hình |
| Bạch tuộc | uốn éo tám xúc tu | | Hiệp sĩ Bóng đêm | lộn ngược ra sau |
| Rắn | trườn tới trườn lui | | Siêu Cún | cất cánh rồi tiếp đất kiểu siêu anh hùng |
| Xương rồng | đung đưa chậm rãi trong gió | | | |
Muốn chọn loài khác? Đặt `species: ninja`. Muốn đặt tên? Đặt `name: Bánh Bao`.

### ✨ Thú lấp lánh

Cứ 64 repo thì có 1 repo nở ra thú **lấp lánh (shiny)** với màu khác và ánh sao, và không có cách nào quay lại.

<img src="docs/gallery/shiny/cat.svg" width="80"> <img src="docs/gallery/shiny/duck.svg" width="80"> <img src="docs/gallery/shiny/ninja.svg" width="80"> <img src="docs/gallery/shiny/dragon.svg" width="80"> <img src="docs/gallery/shiny/bunny.svg" width="80"> <img src="docs/gallery/shiny/hero.svg" width="80">

### 💥 Siêu hình thái

Giữ cho thú **phấn khích 7 ngày liền** là nó biến hình: hào quang vàng rực, cúp 💥 Siêu hình thái
và một câu khoe (*"Đây còn chưa phải hình dạng cuối cùng"*). Chỉ cần một ngày không vui là hào quang tắt, chờ chuỗi tiếp theo.

<img src="docs/gallery/aura/ninja.svg" width="90"> <img src="docs/gallery/aura/mecha.svg" width="90"> <img src="docs/gallery/aura/dragon.svg" width="90"> <img src="docs/gallery/aura/bunny.svg" width="90"> <img src="docs/gallery/aura/bat.svg" width="90"> <img src="docs/gallery/aura/hero.svg" width="90">

### 🏝️ Quê nhà của từng loài

Mỗi loài có một nơi ở riêng, và nơi nào cũng sống động:

<img src="docs/gallery/homes/meadow.svg" width="100" alt="meadow"> <img src="docs/gallery/homes/garden.svg" width="100" alt="garden"> <img src="docs/gallery/homes/pond.svg" width="100" alt="pond"> <img src="docs/gallery/homes/beach.svg" width="100" alt="beach"> <img src="docs/gallery/homes/reef.svg" width="100" alt="reef"> <img src="docs/gallery/homes/jungle.svg" width="100" alt="jungle"> <img src="docs/gallery/homes/desert.svg" width="100" alt="desert">

- 🌳 **Đồng cỏ** (Slime, Siêu Cún): đồi xa có cối xay gió quay, cây đổi màu theo mùa, bướm bay
- 🏡 **Khu vườn** (Mèo, Thỏ Phép Thuật): căn nhà nhỏ sáng đèn ban đêm, hàng rào trắng, hoa hướng dương đung đưa
- 🦆 **Ao** (Vịt): mặt nước lấp lánh, gợn sóng lan tròn, bông lau rung rinh
- 🏖️ **Bãi biển** (Cua): sóng vỗ, bọt biển tràn lên cát, cây dừa, hải âu, vỏ sò và lâu đài cát
- 🐠 **Rạn san hô** (Bạch tuộc): dưới nước có tia nắng, rong biển, san hô, bong bóng và cá bơi ngang. Ban đêm sinh vật phát sáng
- 🌴 **Rừng rậm** (Rắn, Cáo Ninja, Hiệp sĩ Bóng đêm): thác nước, dây leo, sương mù, đom đóm khi trời tối
- 🏜️ **Sa mạc** (Xương rồng, Rồng Thần, Mecha): núi đá đỉnh bằng, hơi nóng bốc lên, bụi cỏ lăn qua

Ban đêm (dark mode) có sao băng, mùa đông có cả cực quang:

<img src="docs/gallery/homes/meadow-night.svg" width="100" alt="meadow"> <img src="docs/gallery/homes/garden-night.svg" width="100" alt="garden"> <img src="docs/gallery/homes/pond-night.svg" width="100" alt="pond"> <img src="docs/gallery/homes/beach-night.svg" width="100" alt="beach"> <img src="docs/gallery/homes/reef-night.svg" width="100" alt="reef"> <img src="docs/gallery/homes/jungle-night.svg" width="100" alt="jungle"> <img src="docs/gallery/homes/desert-night.svg" width="100" alt="desert">

Tâm trạng cũng đổi cảnh: phấn khích hay tiệc tùng thì có cầu vồng, ngày tiệc giăng cờ dây, còn thú zombie thì cây trụi lá, dơi bay và sương mù phủ kín.
Muốn chuyển nhà? Đặt `scenery: beach` (hoặc `--scenery beach` trong CLI).

## 🎮 Chơi cùng thú

### 📜 Nhiệm vụ tuần

Mỗi thứ Hai, thú chọn ba mục tiêu nhỏ dựa trên những gì repo của bạn thật sự làm: commit vào 3 ngày khác nhau, đẩy 10 commit,
giữ CI xanh 4 ngày, trả lời mọi issue đang chờ, merge 2 PR, phát hành một bản release, có commit từ 2 người, giữ thú vui 3 ngày,
hoặc không để gì bị bỏ xó. Repo không có CI sẽ không bao giờ nhận nhiệm vụ về CI.

Mỗi nhiệm vụ xong được ⭐ một sao nhiệm vụ và +5 niềm vui tới hết tuần; xong cả ba được thêm hai sao.
Thẻ hiện tiến độ tuần (`📜 2/3 · ⭐ 14`), `/pet quests` cho xem chi tiết và nhật ký ghi lại từng nhiệm vụ.

### 🧬 Tiến hóa

Sau một tuần trưởng thành, thú tiến hóa theo một trong bốn hệ, tùy cách bạn chăm repo.
Hệ đã chọn là vĩnh viễn, có huy hiệu lơ lửng cạnh đầu và +6 cho chỉ số tương ứng. Ở giai đoạn lão làng, huy hiệu phát sáng.

| Hệ | Đến từ | Thưởng |
| --- | --- | --- |
| 🌪️ Tốc Hành | commit đều tay, chuỗi dài | +6 năng lượng |
| 🛡️ Hộ Vệ | CI luôn xanh | +6 sức khỏe |
| 💞 Kết Nối | nhiều người đóng góp, PR được merge, issue được trả lời | +6 niềm vui |
| 📚 Hiền Triết | hồ sơ cộng đồng đầy đủ và có release | +6 độ no |

<img src="docs/gallery/evolution/swift.svg" width="110"> <img src="docs/gallery/evolution/guardian.svg" width="110"> <img src="docs/gallery/evolution/social.svg" width="110"> <img src="docs/gallery/evolution/sage.svg" width="110">

### 👗 Tủ đồ

16 món đồ: 8 loại mũ, 3 món cho khuôn mặt và 5 bạn đồng hành bay theo thú.
Món nào cũng mở khóa bằng cách chơi: nhờ cúp (🎧 tai nghe khi đạt 100 commit, 🧙 mũ phù thủy ở Lv.50, 👻 ma nhỏ khi hồi sinh),
sao nhiệm vụ (🐦 chim xanh sau sao đầu tiên, 🛸 đĩa bay mini ở 25 sao) hoặc bạn bè (🐤 gà con sau 5 lần xoa đầu, cho ăn hay chơi).

```yaml
      - uses: Tanx-1811/legacypet@v1
        with:
          wear: cap, bird   # một mũ, một món cho mặt, một bạn đồng hành
```

Hoặc để maintainer mặc đồ ngay trong issue bằng `/pet wear headphones` (`/pet wear none` để cởi). `/pet wardrobe` liệt kê mọi món và cách mở khóa.
Mũ mang ý nghĩa trong ngày (mũ tiệc, túi chườm khi ốm, mũ ngủ) vẫn được ưu tiên hôm đó.

<img src="docs/gallery/wardrobe/card-vi.svg" width="520" alt="Thỏ đeo nơ, có bướm bay theo và huy hiệu hệ Kết Nối">

### 🍪 Ăn vặt và chơi đùa

Ai cũng có thể bình luận `/pet feed`, `/pet play` hay `/pet pat`. Thú trả lời kèm ảnh của nó, và mỗi bữa ăn vặt hay trò chơi
cộng một chút chỉ số trong ngày (+4 mỗi lần, tối đa +12). Mỗi người chỉ được làm mỗi việc một lần mỗi ngày, nên spam bình luận
không thể nuôi một con thú bị bỏ bê: commit vẫn là bữa chính. Thú nhớ cả những người bạn thân nhất.

### 🕹️ Playground

[Playground](https://tanx-1811.github.io/legacypet/) chạy đúng engine đó ngay trong trình duyệt, có tiếng Việt:

- **Nở thú**: xem repo công khai bất kỳ nở ra con gì, kèm khám sức khỏe, nhiệm vụ tuần này và hệ tiến hóa đang nghiêng về.
- **Nuôi thử**: tự quyết repo làm gì mỗi ngày (commit, CI, PR, issue, release), cho ăn, chơi, mặc đồ, gõ lệnh `/pet`,
  tua nhanh một tuần hoặc để chế độ tự chơi chạy. Có thông báo mỗi lần lên cấp, xong nhiệm vụ hay mở cúp.
- **Sổ tay**: mọi loài, tâm trạng, hệ tiến hóa, món đồ, nhiệm vụ, cấp bậc, cúp và quê nhà, kèm cách đạt được.
- **Công viên**: ghép Công viên thú từ các repo bất kỳ.
- **Nhận nuôi**: chọn một lần, chép lệnh, file workflow và đoạn README.

## 💬 Nói chuyện với thú: `/pet`

Bình luận trong bất kỳ issue hay pull request nào, thú sẽ trả lời ngay trong thread, bằng ngôn ngữ của nó:

| Lệnh | Thú trả lời |
| --- | --- |
| `/pet` | Thẻ, tâm trạng, chỉ số và kết quả khám sức khỏe |
| `/pet pat` | Xoa đầu 💕 |
| `/pet feed` · `/pet play` | Cho ăn vặt hoặc chơi cùng, thú trả lời kèm ảnh (mỗi người một lần mỗi ngày) |
| `/pet quests` | Nhiệm vụ tuần này, thanh tiến độ và số sao nhiệm vụ |
| `/pet wardrobe` | Mọi món đồ, đồ đang mặc và đồ còn khóa |
| `/pet wear cap` | Mặc đồ cho thú (`/pet wear none` để cởi). Chỉ maintainer |
| `/pet checkup` | Chỉ phần khám sức khỏe |
| `/pet level` | Cấp, hạng, thanh XP và số commit cần để lên cấp, lên hạng |
| `/pet trophies` | Kệ cúp, kèm ngày mở khóa và các cúp còn khóa |
| `/pet vacation 14` | Đi biển 14 ngày (chỉ maintainer) |
| `/pet back` | Về nhà sớm (chỉ maintainer) |
| `/pet help` | Danh sách lệnh |

Cần trigger `issue_comment` và quyền `issues: write` / `pull-requests: write` (đã có sẵn trong workflow mẫu ở trên).
Bình luận của bot bị bỏ qua, và dòng `if:` giúp các bình luận khác không khởi động workflow. Đặt `commands: false` để tắt.

## 🌍 7 ngôn ngữ

`lang:` nhận `en` (English), `vi` (Tiếng Việt), `ja` (日本語), `zh` (中文), `ko` (한국어), `es` (Español), `fr` (Français).
Tiếng Nhật, Trung, Hàn được ngắt dòng đúng trong bong bóng thoại. Muốn thêm ngôn ngữ? Xem [CONTRIBUTING.md](CONTRIBUTING.md#translate).

<img src="docs/gallery/langs/ja.svg" width="420"> <img src="docs/gallery/langs/zh.svg" width="420">

## 🏞️ Công viên thú

<img src="docs/gallery/park/park-vi.svg" alt="Công viên thú với sáu con thú" width="840">

Thêm `park: auto` vào workflow trong repo profile (lấy 6 repo nhiều sao nhất của bạn), hoặc liệt kê `park: app, dotfiles, owner-khac/lib`.
Repo nào đã có LegacyPet riêng thì giữ nguyên tên, loài và cúp khi vào công viên.

## 🩺 Khám sức khỏe repo

Mỗi lần chạy, action viết vào job summary lý do con thú đang vui hay buồn và việc nên làm,
ví dụ *"3 issue từ cộng đồng đang chờ phản hồi đầu tiên. Lâu nhất là #12 (87 ngày)"*.
Nhánh `legacypet` còn có biểu đồ tâm trạng 14 ngày gần nhất và nhật ký `DIARY.md`.

## 🏅 Cấp và hạng

Cấp là `√(tổng số commit) + 1`: Lv.11 ở 100 commit, Lv.32 ở 1.000 commit.
Mỗi lần lên cấp là một sự kiện: chữ **LÊN CẤP!** bay trên đầu thú, nó khoe trong bong bóng thoại, nhật ký ghi lại và action bật output `level-up`.
Các cấp được chia thành 7 hạng, hiện cạnh cấp trên thẻ và badge, thanh XP đổi màu theo hạng:

| Hạng | Cấp | Số commit |
| --- | --- | --- |
| 🌱 Tân binh | 1–9 | 0+ |
| 🥉 Đồng | 10–19 | 81+ |
| 🥈 Bạc | 20–34 | 361+ |
| 🥇 Vàng | 35–49 | 1.156+ |
| 💠 Bạch kim | 50–69 | 2.401+ |
| 💎 Kim cương | 70–89 | 4.761+ |
| 👑 Huyền thoại | 90–99 | 7.921+ |

Lên hạng thì có chữ riêng mang màu của hạng mới. Gõ `/pet level` để xem còn bao nhiêu commit nữa là lên cấp và lên hạng.
Rồng Thần tính mỗi commit bằng 1,5 nên leo hạng nhanh hơn.

<img src="docs/gallery/ranks/rank-up-vi.svg" width="520" alt="Thỏ Phép Thuật lên hạng Bạc">

## Còn gì nữa?

- 🎂 Lớn lên: Trứng → Bé (có mầm cây) → Trưởng thành → Lão làng (đeo kính một tròng)
- 🏆 24 cúp vĩnh viễn: Bốc lửa (chuỗi 7 ngày), Hồi sinh, Siêu sao (kèm vương miện), Siêu hình thái, Kỳ cựu (Lv.25), Bậc thầy (Lv.50), Cấp tối đa (Lv.99)…
- 🍂 Theo mùa: hoa xuân, đom đóm hè, lá thu, tuyết đông. Ở dark mode thì thành ban đêm có trăng sao, sao băng và cực quang mùa đông
- 🧧 Ngày lễ: Tết có đèn lồng, pháo hoa và cành mai vàng rụng cánh, Halloween có mũ phù thủy và đàn dơi, Giáng sinh có mũ ông già Noel, người tuyết và dây đèn nhấp nháy
- 💬 Lời thoại theo dữ liệu thật: *"Này... issue #12 chờ phản hồi 87 ngày rồi đó"*
- ♿ Hỗ trợ trình đọc màn hình và tự tắt chuyển động khi người xem bật reduced motion

## Cấu hình

| Input | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `species` | `auto` | `auto` hoặc một trong 13 loài ở trên |
| `scenery` | `auto` | Nơi ở: `auto` (quê nhà của loài), `meadow`, `garden`, `pond`, `beach`, `reef`, `jungle`, `desert` |
| `name` | | Tên tự đặt. Để trống thì repo tự đặt tên |
| `lang` | `en` | `en`, `vi`, `ja`, `zh`, `ko`, `es`, `fr` |
| `theme` | `auto` | `auto` theo chế độ sáng/tối của người xem, hoặc `light`, `dark` |
| `park` | | Vẽ thêm `park.svg`: `auto` hoặc danh sách repo |
| `commands` | `true` | Trả lời lệnh `/pet` trong issue và PR |
| `vacation` | | Đi nghỉ: `until 2027-01-05` hoặc `2026-12-20..2027-01-05` (tối đa 60 ngày) |
| `alerts` | `false` | `true` (ốm + zombie) hoặc danh sách `sick`, `zombie`, `hungry`, `sad`. Cần `issues: write` |
| `wear` | | Đồ đã mở khóa muốn mặc, ví dụ `cap, bird`. Để trống thì dùng `/pet wear` |
| `keepalive` | `true` | Không để GitHub tạm dừng lịch chạy sau 60 ngày im ắng (cần `actions: write`) |

**Output:** `mood`, `previous-mood`, `mood-changed`, `name`, `level`, `species`, `stage`, `speech`, `aura`, `new-trophies`, `level-up`, `rank`, `on-vacation`, `alert-issue`, `path`, `quest-stars`, `quests-done`, `wearing`, `svg-path`.
Ví dụ, chỉ báo cho team khi thú *vừa* bị ốm:

```yaml
      - uses: Tanx-1811/legacypet@v1
        id: pet
      - if: steps.pet.outputs.mood == 'sick' && steps.pet.outputs.mood-changed == 'true'
        run: echo "${{ steps.pet.outputs.name }} đang ốm! ${{ steps.pet.outputs.speech }}"
```

Danh sách đầy đủ, công thức tính chỉ số và CLI có trong [README tiếng Anh](README.md#configuration).

## Hỏi đáp

**Có làm rối lịch sử commit không?** Không. Thú sống trên nhánh riêng, mỗi lần chạy nhánh đó được thay bằng đúng một commit.

**Repo private dùng được không?** Được. Action chạy ngay trong repo nên token mặc định đọc được nó.
Chỉ khác link ảnh: `raw.githubusercontent.com` không phục vụ file private, nên hãy dùng `https://github.com/OWNER/REPO/blob/legacypet/pet.svg?raw=true`, GitHub sẽ hiện ảnh cho mọi người có quyền xem repo.
`init` và nút **Adopt** trên website tự chọn link này cho bạn (thêm `--private` nếu `init` đoán sai).
Badge shields.io và việc nhúng thú ra ngoài GitHub thì không chạy với repo private, vì bên ngoài không ai đọc được nó.

**Làm sao nhận tính năng mới?** `@v1` luôn trỏ tới bản 1.x mới nhất, nên bạn được cập nhật tự động ở lần chạy kế tiếp.
Lần đầu chạy bản mới, trang Actions hiện thông báo và job summary liệt kê **có gì mới**.
Nếu tính năng cần sửa file workflow (như `/pet` cần trigger `issue_comment`), summary sẽ nói rõ.
Chạy lại `npx github:Tanx-1811/legacypet init --force` để làm mới workflow, hoặc bấm **Watch → Custom → Releases** để nhận email khi có bản mới.
Thay đổi phá vỡ tương thích chỉ ra ở tag mới (`@v2`). Lịch sử các bản có trong [CHANGELOG.md](CHANGELOG.md).

**Có gửi dữ liệu đi đâu không?** Không. Nó đọc GitHub API bằng token của workflow và ghi vào repo của bạn, chỉ vậy thôi.

## Đóng góp

Cách đóng góp dễ nhất là **vẽ một loài mới**: một lưới 16×16 ký tự, một bảng màu, một đặc tính và một nơi ở.
Mất khoảng 10 phút, và `npm run gallery` cho xem ngay loài đó ở mọi tâm trạng. Xem [CONTRIBUTING.md](CONTRIBUTING.md).

## Giấy phép

[MIT](LICENSE). Cứ nhận nuôi thoải mái.
